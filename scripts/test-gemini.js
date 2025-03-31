/**
 * test-gemini.js
 * A simple test script to verify the improvements to the callGemini function.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { spawn } from "child_process";
import chalk from "chalk";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test PRDs of varying sizes
const smallPRD = `
# Small Test PRD

This is a small test PRD to verify the callGemini function improvements.

## Requirements

1. Create a simple web application
2. Add user authentication
3. Implement basic CRUD operations
`;

const mediumPRD = `
# Medium Test PRD

This is a medium-sized test PRD to verify the callGemini function improvements.

## Requirements

1. Create a web application with multiple pages
2. Implement user authentication and authorization
3. Add database integration with PostgreSQL
4. Create RESTful API endpoints
5. Add file upload functionality
6. Implement real-time notifications
7. Add search functionality
8. Create admin dashboard
`;

const largePRD = `
# Large Test PRD

This is a large test PRD to verify the callGemini function improvements.

## Requirements

1. Create a scalable web application
2. Implement OAuth2 authentication
3. Add support for multiple databases
4. Create comprehensive API documentation
5. Implement WebSocket functionality
6. Add file upload with cloud storage
7. Create admin dashboard
8. Add analytics tracking
9. Implement email notifications
10. Add search with elasticsearch
11. Create mobile-responsive design
12. Add internationalization support
13. Implement rate limiting
14. Add caching layer
15. Create backup system
`;

// Test function
async function runTest(prd, size) {
  console.log(chalk.blue(`\nTesting ${size} PRD...`));

  // Write PRD to temporary file
  const tempFile = path.join(__dirname, `temp_${size}_prd.txt`);
  fs.writeFileSync(tempFile, prd);

  // Run the dev.js script with the PRD
  const child = spawn("node", ["dev.js", "parse-prd", "--input", tempFile], {
    cwd: __dirname,
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      // Clean up temp file
      fs.unlinkSync(tempFile);

      if (code === 0) {
        console.log(chalk.green(`✓ ${size} PRD test passed`));
        resolve();
      } else {
        console.error(chalk.red(`✗ ${size} PRD test failed with code ${code}`));
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

// Run tests
console.log("Starting tests for callGemini function improvements...");

(async () => {
  try {
    await runTest(smallPRD, "small");
    await runTest(mediumPRD, "medium");
    await runTest(largePRD, "large");
    console.log(chalk.green("\nAll tests passed successfully!"));
  } catch (error) {
    console.error(chalk.red("\nTest suite failed:"), error);
    process.exit(1);
  }
})();
