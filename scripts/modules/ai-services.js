/**
 * ai-services.js
 * AI service interactions for the Task Master CLI
 */

// NOTE/TODO: Include the beta header output-128k-2025-02-19 in your API request to increase the maximum output token length to 128k tokens for Claude 3.7 Sonnet.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG, log } from "./utils.js";
import { startLoadingIndicator, stopLoadingIndicator } from "./ui.js";

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

/**
 * Generate subtasks with research using Gemini
 * @param {Object} task - The task to generate subtasks for
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {number} nextSubtaskId - Next available subtask ID
 * @param {string} additionalContext - Additional context for generation
 * @returns {Promise<Array>} Array of generated subtasks
 */
async function generateSubtasksWithGeminiWithResearch(task, numSubtasks = 3, nextSubtaskId = 1, additionalContext = "") {
  try {
    // First, perform research to get context
    log("info", `Researching context for task ${task.id}: ${task.title}`);

    const researchLoadingIndicator = startLoadingIndicator("Researching best practices with Gemini AI...");

    // Formulate research query based on task
    const researchQuery = `I need to implement "${task.title}" which involves: "${task.description}". 
What are current best practices, libraries, design patterns, and implementation approaches? 
Include concrete code examples and technical considerations where relevant.`;

    // Query Gemini for research
    const researchResponse = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: researchQuery }] }],
      generationConfig: {
        temperature: 0.1, // Lower temperature for more factual responses
        maxOutputTokens: CONFIG.maxTokens,
      },
    });

    const researchResult = researchResponse.response.text();

    stopLoadingIndicator(researchLoadingIndicator);
    log("info", "Research completed, now generating subtasks with additional context");

    // Use the research result as additional context for Gemini to generate subtasks
    const combinedContext = `
RESEARCH FINDINGS:
${researchResult}

ADDITIONAL CONTEXT PROVIDED BY USER:
${additionalContext || "No additional context provided."}
`;

    // Now generate subtasks with Gemini
    const loadingIndicator = startLoadingIndicator(`Generating research-backed subtasks for task ${task.id}...`);
    let streamingInterval = null;
    let responseText = "";

    const systemPrompt = `You are an AI assistant helping with task breakdown for software development.
You need to break down a high-level task into ${numSubtasks} specific subtasks that can be implemented one by one.

You have been provided with research on current best practices and implementation approaches.
Use this research to inform and enhance your subtask breakdown.

Subtasks should:
1. Be specific and actionable implementation steps
2. Follow a logical sequence
3. Each handle a distinct part of the parent task
4. Include clear guidance on implementation approach
5. Have appropriate dependency chains between subtasks
6. Collectively cover all aspects of the parent task

For each subtask, provide:
- A clear, specific title
- Detailed implementation steps that incorporate best practices from the research
- Dependencies on previous subtasks
- Testing approach

Each subtask should be implementable in a focused coding session.`;

    const userPrompt = `Please break down this task into ${numSubtasks} specific, well-researched, actionable subtasks:

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Current details: ${task.details || "None provided"}

${combinedContext}

Return exactly ${numSubtasks} subtasks with the following JSON structure:
[
  {
    "id": ${nextSubtaskId},
    "title": "First subtask title",
    "description": "Detailed description incorporating research",
    "dependencies": [], 
    "details": "Implementation details with best practices"
  },
  ...more subtasks...
]

Note on dependencies: Subtasks can depend on other subtasks with lower IDs. Use an empty array if there are no dependencies.`;

    try {
      // Update loading indicator to show streaming progress
      let dotCount = 0;
      const readline = await import("readline");
      streamingInterval = setInterval(() => {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`Generating research-backed subtasks for task ${task.id}${".".repeat(dotCount)}`);
        dotCount = (dotCount + 1) % 4;
      }, 500);

      // Use Gemini API call
      const stream = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: CONFIG.temperature,
          maxOutputTokens: CONFIG.maxTokens,
        },
        systemInstruction: systemPrompt,
      });

      // Process the stream
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.text) {
          responseText += chunk.delta.text;
        }
      }

      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);

      log("info", `Completed generating research-backed subtasks for task ${task.id}`);

      // Extract JSON from response
      const jsonStart = responseText.indexOf("[");
      const jsonEnd = responseText.lastIndexOf("]");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Could not find valid JSON array in Gemini's response");
      }

      const jsonText = responseText.substring(jsonStart, jsonEnd + 1);
      const subtasks = JSON.parse(jsonText);

      // Validate subtasks
      if (!Array.isArray(subtasks)) {
        throw new Error("Generated subtasks is not an array");
      }

      if (subtasks.length === 0) {
        throw new Error("No subtasks were generated");
      }

      return subtasks;
    } catch (error) {
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    log("error", `Error generating research-backed subtasks: ${error.message}`);
    throw error;
  }
}

/**
 * Generate subtasks with Gemini
 * @param {Object} task - The task to generate subtasks for
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {number} nextSubtaskId - Next available subtask ID
 * @param {string} additionalContext - Additional context for generation
 * @returns {Promise<Array>} Array of generated subtasks
 */
async function generateSubtasksWithGemini(task, numSubtasks, nextSubtaskId, additionalContext = "") {
  try {
    log("info", `Generating ${numSubtasks} subtasks for task ${task.id}: ${task.title}`);

    const loadingIndicator = startLoadingIndicator(`Generating subtasks for task ${task.id}...`);

    const prompt = `Generate ${numSubtasks} detailed subtasks for the following software development task:

Task: ${task.title}
Description: ${task.description}
Details: ${task.details}
Test Strategy: ${task.testStrategy}

${additionalContext ? `Additional Context: ${additionalContext}\n` : ""}

Each subtask should:
1. Have a clear, specific title
2. Include a detailed description of what needs to be done
3. List any dependencies on other subtasks (if applicable)
4. Have acceptance criteria for verification

Return the subtasks as a valid JSON array in this format:
[
  {
    "id": number (starting from ${nextSubtaskId}),
    "title": "string",
    "description": "string",
    "status": "pending",
    "dependencies": [number],
    "acceptanceCriteria": "string"
  }
]

IMPORTANT: Return ONLY the JSON array, nothing else.`;

    try {
      // Use Gemini API call
      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: CONFIG.temperature,
          maxOutputTokens: CONFIG.maxTokens,
        },
      });

      const responseText = result.response.text();
      stopLoadingIndicator(loadingIndicator);

      log("info", `Completed generating subtasks for task ${task.id}`);

      // Extract JSON from response
      const jsonStart = responseText.indexOf("[");
      const jsonEnd = responseText.lastIndexOf("]");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Could not find valid JSON array in Gemini's response");
      }

      const jsonText = responseText.substring(jsonStart, jsonEnd + 1);
      const subtasks = JSON.parse(jsonText);

      // Validate subtasks
      if (!Array.isArray(subtasks)) {
        throw new Error("Generated subtasks is not an array");
      }

      if (subtasks.length === 0) {
        throw new Error("No subtasks were generated");
      }

      return subtasks;
    } catch (error) {
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    log("error", `Error generating subtasks with Gemini: ${error.message}`);
    throw error;
  }
}

export { callGemini, generateComplexityAnalysisPrompt, geminiModel, generateSubtasksWithGeminiWithResearch, generateSubtasksWithGemini };
