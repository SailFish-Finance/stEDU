// Script to run tests for stEDU and wstEDU contracts

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);

// Define test files
const testFiles = [
  'stEDU.test.js',
  'wstEDU.test.js',
  'integration.test.js',
  'fullcycle.test.js',
  'edgecases.test.js'
];

// Function to run tests
function runTests(files) {
  console.log('Running tests...');
  
  try {
    // Compile contracts first
    console.log('Compiling contracts...');
    execSync('npx hardhat compile', { stdio: 'inherit' });
    console.log('Compilation successful!\n');
    
    // Run tests
    for (const file of files) {
      console.log(`Running tests in ${file}...`);
      execSync(`npx hardhat test ./test/${file} --no-compile`, { stdio: 'inherit' });
      console.log(`Tests in ${file} completed successfully!\n`);
    }
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Error running tests:', error.message);
    process.exit(1);
  }
}

// Function to run a specific test file
function runSpecificTest(testName) {
  const matchingFiles = testFiles.filter(file => file.includes(testName));
  
  if (matchingFiles.length === 0) {
    console.error(`No test files found matching "${testName}"`);
    process.exit(1);
  }
  
  console.log(`Found ${matchingFiles.length} matching test files:`);
  matchingFiles.forEach(file => console.log(`- ${file}`));
  console.log('');
  
  runTests(matchingFiles);
}

// Main execution
if (args.length === 0) {
  // Run all tests
  runTests(testFiles);
} else if (args[0] === '--help' || args[0] === '-h') {
  // Show help
  console.log('Usage:');
  console.log('  node run-tests.js                  Run all tests');
  console.log('  node run-tests.js <test-name>      Run tests matching the given name');
  console.log('  node run-tests.js --list           List all available test files');
  console.log('  node run-tests.js --help           Show this help message');
} else if (args[0] === '--list') {
  // List all test files
  console.log('Available test files:');
  testFiles.forEach(file => console.log(`- ${file}`));
} else {
  // Run specific test
  runSpecificTest(args[0]);
}
