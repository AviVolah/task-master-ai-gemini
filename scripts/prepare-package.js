#!/usr/bin/env node

/**
 * This script prepares the package for publication to NPM.
 * It ensures all necessary files are included and properly configured.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define colors for console output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Log function with color support
function log(level, ...args) {
  const prefix = {
    info: `${COLORS.blue}[INFO]${COLORS.reset}`,
    warn: `${COLORS.yellow}[WARN]${COLORS.reset}`,
    error: `${COLORS.red}[ERROR]${COLORS.reset}`,
    success: `${COLORS.green}[SUCCESS]${COLORS.reset}`
  }[level.toLowerCase()];
  
  console.log(prefix, ...args);
}

// Function to check if a file exists
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Function to ensure a file is executable
function ensureExecutable(filePath) {
  try {
    fs.chmodSync(filePath, '755');
    log('info', `Made ${filePath} executable`);
  } catch (error) {
    log('error', `Failed to make ${filePath} executable:`, error.message);
    return false;
  }
  return true;
}

// Function to sync files from source to templates
function syncTemplateFiles() {
  // Define files to sync in format: [source, target]
  const filesToSync = [
    // Scripts
    ['scripts/dev.js', 'templates/dev.js'],
    
    // Documentation files
    ['README.md', 'templates/README.md'],
    ['scripts/README.md', 'templates/scripts_README.md'],
    
    // Other files that might need syncing
    // Add more files here as needed
  ];
  
  let allSynced = true;
  const rootDir = path.join(__dirname, '..');
  
  for (const [source, target] of filesToSync) {
    const sourcePath = path.join(rootDir, source);
    const targetPath = path.join(rootDir, target);
    
    try {
      if (fileExists(sourcePath)) {
        log('info', `Syncing ${source} to ${target}...`);
        fs.copyFileSync(sourcePath, targetPath);
        log('success', `Successfully synced ${source} to ${target}`);
      } else {
        log('error', `Source file ${source} does not exist`);
        allSynced = false;
      }
    } catch (error) {
      log('error', `Failed to sync ${source} to ${target}:`, error.message);
      allSynced = false;
    }
  }
  
  return allSynced;
}

// Main function to prepare the package
function preparePackage() {
  const rootDir = path.join(__dirname, '..');
  log('info', `Preparing package in ${rootDir}`);
  
  // Sync template files to ensure templates have the latest versions
  log('info', 'Syncing template files...');
  if (!syncTemplateFiles()) {
    log('warn', 'Some template files could not be synced. Continuing with preparation...');
  }
  
  // Check for required files
  const requiredFiles = [
    'package.json',
    'README.md',
    'index.js',
    'scripts/init.js',
    'scripts/dev.js'
  ];
  
  let allFilesExist = true;
  for (const file of requiredFiles) {
    const filePath = path.join(rootDir, file);
    if (!fileExists(filePath)) {
      log('error', `Required file ${file} does not exist`);
      allFilesExist = false;
    }
  }
  
  if (!allFilesExist) {
    log('error', 'Some required files are missing. Package preparation failed.');
    process.exit(1);
  }
  
  // Ensure scripts are executable
  const executableScripts = [
    'scripts/init.js',
    'scripts/dev.js'
  ];
  
  let allScriptsExecutable = true;
  for (const script of executableScripts) {
    const scriptPath = path.join(rootDir, script);
    if (!ensureExecutable(scriptPath)) {
      allScriptsExecutable = false;
    }
  }
  
  if (!allScriptsExecutable) {
    log('warn', 'Some scripts could not be made executable. This may cause issues.');
  }
  
  // Check templates directory
  const templatesDir = path.join(rootDir, 'templates');
  if (!fileExists(templatesDir)) {
    log('error', 'Templates directory does not exist');
    process.exit(1);
  }
  
  // Check template files
  const requiredTemplates = [
    'README.md',
    'env.example',
    'gitignore',
    'dev_workflow.mdc',
    'dev.js',
    'scripts_README.md',
    'example_prd.txt'
  ];
  
  let allTemplatesExist = true;
  for (const template of requiredTemplates) {
    const templatePath = path.join(templatesDir, template);
    if (!fileExists(templatePath)) {
      log('error', `Required template ${template} does not exist`);
      allTemplatesExist = false;
    }
  }
  
  if (!allTemplatesExist) {
    log('error', 'Some required templates are missing. Package preparation failed.');
    process.exit(1);
  }
  
  // Run npm pack to test package creation
  try {
    log('info', 'Running npm pack to test package creation...');
    const output = execSync('npm pack --dry-run', { cwd: rootDir }).toString();
    log('info', output);
  } catch (error) {
    log('error', 'Failed to run npm pack:', error.message);
    process.exit(1);
  }
  
  // Make scripts executable
  log('info', 'Making scripts executable...');
  try {
    execSync('chmod +x scripts/init.js', { stdio: 'ignore' });
    log('info', 'Made scripts/init.js executable');
    execSync('chmod +x scripts/dev.js', { stdio: 'ignore' });
    log('info', 'Made scripts/dev.js executable');
  } catch (error) {
    log('error', 'Failed to make scripts executable:', error.message);
  }
  
  log('success', 'Package preparation completed successfully!');
  log('info', 'You can now publish the package with:');
  log('info', '  npm publish');
}

// Run the preparation
preparePackage(); 