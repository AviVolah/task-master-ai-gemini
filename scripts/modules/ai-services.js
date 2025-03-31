/**
 * ai-services.js
 * AI service interactions for the Task Master CLI
 */

// NOTE/TODO: Include the beta header output-128k-2025-02-19 in your API request to increase the maximum output token length to 128k tokens for Claude 3.7 Sonnet.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG, log } from "./utils.js";

// Debug logging for environment variables
log("debug", "Environment variables:");
log("debug", `GEMINI_API_KEY exists: ${!!process.env.GEMINI_API_KEY}`);
log("debug", `GOOGLE_API_KEY exists: ${!!process.env.GOOGLE_API_KEY}`);
log("debug", `MODEL: ${process.env.MODEL}`);
log("debug", `CONFIG.model: ${CONFIG.model}`);

// Initialize Gemini client
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error("No Gemini API key found. Please set GEMINI_API_KEY or GOOGLE_API_KEY in your environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Validate and initialize model
let geminiModel;
try {
  geminiModel = genAI.getGenerativeModel({ model: CONFIG.model });
  log("debug", `Initialized Gemini model: ${CONFIG.model}`);
} catch (error) {
  log("error", `Error initializing Gemini model: ${error.message}`);
  log("error", "Available models: gemini-1.5-pro, gemini-1.5-pro-latest, gemini-1.5-pro-vision");
  throw error;
}

/**
 * Call Gemini API with streaming
 * @param {string} prdContent - The PRD content to analyze
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @returns {Promise<string>} The generated response
 */
async function callGemini(prdContent, prdPath, numTasks) {
  try {
    const systemPrompt = `You are an AI assistant helping to break down a Product Requirements Document (PRD) into a set of sequential development tasks. 
Your goal is to create ${numTasks} well-structured, actionable development tasks based on the PRD provided.

Each task should follow this JSON structure:
{
  "id": number,
  "title": string,
  "description": string,
  "status": "pending",
  "dependencies": number[] (IDs of tasks this depends on),
  "priority": "high" | "medium" | "low",
  "details": string (implementation details),
  "testStrategy": string (validation approach)
}

Guidelines:
1. Create exactly ${numTasks} tasks, numbered from 1 to ${numTasks}
2. Each task should be atomic and focused on a single responsibility
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs)
7. Assign priority (high/medium/low) based on criticality and dependency order
8. Include detailed implementation guidance in the "details" field

Expected output format:
{
  "tasks": [
    {
      "id": 1,
      "title": "Setup Project Repository",
      "description": "...",
      ...
    },
    ...
  ],
  "metadata": {
    "projectName": "PRD Implementation",
    "totalTasks": ${numTasks},
    "sourceFile": "${prdPath}",
    "generatedAt": "YYYY-MM-DD"
  }
}

Important: Your response must be valid JSON only, with no additional explanation or comments.`;

    const userPrompt = `Please analyze this PRD and generate ${numTasks} sequential development tasks:

${prdContent}`;

    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: CONFIG.temperature,
        maxOutputTokens: CONFIG.maxTokens,
      },
      systemInstruction: systemPrompt,
    });

    return result.response.text();
  } catch (error) {
    log("error", `Error calling Gemini API: ${error.message}`);
    throw error;
  }
}

/**
 * Generate a prompt for task complexity analysis
 * @param {Object[]} tasks - Array of tasks to analyze
 * @returns {string} The generated prompt
 */
function generateComplexityAnalysisPrompt(tasksData) {
  return `Analyze the complexity of the following tasks and provide recommendations for subtask breakdown:

${tasksData.tasks
  .map(
    (task) => `
Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Details: ${task.details}
Dependencies: ${JSON.stringify(task.dependencies || [])}
Priority: ${task.priority || "medium"}
`
  )
  .join("\n---\n")}

Analyze each task and return a JSON array with the following structure for each task:
[
  {
    "taskId": number,
    "taskTitle": string,
    "complexityScore": number (1-10),
    "recommendedSubtasks": number (${Math.max(3, CONFIG.defaultSubtasks - 1)}-${Math.min(8, CONFIG.defaultSubtasks + 2)}),
    "expansionPrompt": string (a specific prompt for generating good subtasks),
    "reasoning": string (brief explanation of your assessment)
  },
  ...
]

IMPORTANT: Make sure to include an analysis for EVERY task listed above, with the correct taskId matching each task's ID.
`;
}

export { callGemini, generateComplexityAnalysisPrompt, geminiModel };
