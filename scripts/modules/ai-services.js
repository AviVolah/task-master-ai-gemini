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
 * @param {string} prompt - The prompt to send to the API
 * @returns {Promise<string>} The generated response
 */
async function callGemini(prompt) {
  try {
    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: CONFIG.temperature,
        maxOutputTokens: CONFIG.maxTokens,
      },
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
function generateComplexityAnalysisPrompt(tasks) {
  const prompt = `Analyze the complexity of the following software development tasks.
For each task, consider:
- Technical complexity and implementation challenges
- Dependencies and integration requirements
- Potential risks and edge cases
- Required expertise and knowledge
- Testing requirements and validation complexity

Return a JSON array of task analyses in this format:
[
  {
    "taskId": number,
    "taskTitle": "string",
    "complexityScore": number (1-10),
    "recommendedSubtasks": number,
    "expansionPrompt": "string - specific guidance for breaking down this task",
    "reasoning": "string - brief explanation of complexity factors"
  }
]

Tasks to analyze:
${JSON.stringify(tasks, null, 2)}

IMPORTANT: Return ONLY the JSON array, nothing else.`;

  return prompt;
}

export { callGemini, generateComplexityAnalysisPrompt, geminiModel };
