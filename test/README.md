# stEDU and wstEDU Tests

This folder contains comprehensive test suites for the stEDU and wstEDU smart contracts. The tests verify both individual functionalities and complex integration scenarios.

## Test Structure

The tests are organized into the following categories:

### 1. Unit Tests

- `stEDU.test.js` - Tests for individual stEDU contract functions
- `wstEDU.test.js` - Tests for individual wstEDU contract functions

### 2. Integration Tests

- `integration.test.js` - Tests interactions between stEDU and wstEDU contracts

### 3. Scenario Tests

- `scenarios.test.js` - Tests complex user flows and scenarios
- `fullcycle.test.js` - Extended full cycle test with multiple users and actions

### 4. Edge Case Tests

- `edgecases.test.js` - Tests for boundary conditions and edge cases

## Key Test Scenarios

### Basic Functionality Tests

- Staking EDU to receive stEDU
- Unstaking stEDU to receive EDU
- Wrapping stEDU to wstEDU
- Unwrapping wstEDU to stEDU
- Reward distribution and rebasing

### Advanced Scenarios

- **Full Cycle Test**: Simulates real-world usage with multiple users, multiple reward distributions, and various user interactions over time.
- **Leverage Loop Simulation**: Simulates the recursive leverage strategy (stake → wrap → use as collateral → borrow → stake again).

### Edge Cases and Security Tests

- Math precision tests
- Reentrancy protection
- State consistency validation
- Gas optimization checks
- Extreme supply and reward scenarios

## Running the Tests

```bash
# Run all tests
npx hardhat test

# Run a specific test file
npx hardhat test ./test/stEDU.test.js

# Run with gas reporting
npx hardhat test --gas

# Run with coverage
npx hardhat coverage
```

## Test Helper Files

- `helpers.js` - Common utility functions for testing
- `constants.js` - Constants and configurations used across tests
- `fixtures.js` - Test fixtures and setup functions

## Testing Architecture

The tests use:

1. **Hardhat Network** for local blockchain simulation
2. **Chai** and **Mocha** for assertions and test structure
3. **ethers.js** for blockchain interaction
4. **Time manipulation** functions to simulate passage of time
5. **Fixtures** for efficient test setup and state sharing

## Code Coverage

The test suite aims to achieve 100% code coverage across all contract functions, with particular emphasis on edge cases and security considerations.
