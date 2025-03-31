/**
 * Generates a prompt for task complexity analysis
 * @param {Object} tasks - Tasks data object
 * @returns {string} - Generated prompt
 */
export function generateComplexityAnalysisPrompt(tasks) {
  const prompt = `You are a technical project manager analyzing software development tasks.
Please analyze each task and provide a complexity assessment.

For each task, consider:
1. Technical complexity
2. Dependencies and integration points
3. Potential risks and challenges
4. Required expertise level
5. Testing requirements

Tasks to analyze:
${JSON.stringify(tasks, null, 2)}

Provide your analysis in this exact JSON format:
[
  {
    "taskId": number,
    "taskTitle": "string",
    "complexityScore": number (1-10),
    "recommendedSubtasks": number,
    "expansionPrompt": "string - prompt to expand this task if needed",
    "reasoning": "string - explanation of complexity assessment"
  }
]

IMPORTANT:
- Respond ONLY with the JSON array
- complexityScore should be 1-10 (1=simplest, 10=most complex)
- Include ALL tasks in the analysis
- Keep reasoning concise but informative
- Format must be valid JSON`;

  return prompt;
}
