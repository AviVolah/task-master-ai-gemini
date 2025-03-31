/**
 * test-gemini-errors.js
 * A test script to verify error handling in the callGemini function.
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

// Test PRDs that should trigger errors
const malformedPRD = `
# Malformed PRD

This PRD is intentionally malformed to test error handling.

## Requirements
1. This requirement is incomplete...

## Technical Stack
- Frontend: [Missing information]
- Backend: [Missing information]
`;

const emptyPRD = "";

const invalidFormatPRD = `
Not a proper PRD format
Just some random text
Without proper sections
Or structure
`;

// Test function
async function runErrorTest(prd, description) {
  console.log(chalk.blue(`\nTesting error handling: ${description}...`));

  // Write PRD to temporary file
  const tempFile = path.join(__dirname, `temp_error_${Date.now()}.txt`);
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

      // For error tests, we expect non-zero exit codes
      if (code !== 0) {
        console.log(chalk.green(`✓ Error test passed: ${description} (exit code ${code})`));
        resolve();
      } else {
        console.error(chalk.red(`✗ Error test failed: ${description} (expected error, got success)`));
        reject(new Error(`Expected error but got success for ${description}`));
      }
    });
  });
}

// Run error tests
console.log("Starting error handling tests for callGemini function...");

(async () => {
  try {
    await runErrorTest(malformedPRD, "Malformed PRD");
    await runErrorTest(emptyPRD, "Empty PRD");
    await runErrorTest(invalidFormatPRD, "Invalid PRD format");
    console.log(chalk.green("\nAll error handling tests passed successfully!"));
  } catch (error) {
    console.error(chalk.red("\nError handling test suite failed:"), error);
    process.exit(1);
  }
})();
