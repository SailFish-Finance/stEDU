# stEDU and wstEDU Test Suite

This document provides an overview of the comprehensive test suite for the stEDU and wstEDU contracts.

## Test Structure

The tests are organized into the following categories:

### 1. Unit Tests

- `stEDU.test.js` - Tests for individual stEDU contract functions
- `wstEDU.test.js` - Tests for individual wstEDU contract functions

### 2. Integration Tests

- `integration.test.js` - Tests interactions between stEDU and wstEDU contracts

### 3. Scenario Tests

- `fullcycle.test.js` - Extended full cycle test with multiple users and actions

### 4. Edge Case Tests

- `edgecases.test.js` - Tests for boundary conditions and edge cases

## Test Coverage

The test suite covers:

1. **Basic Functionality**
   - Staking EDU to receive stEDU
   - Unstaking stEDU to receive EDU
   - Wrapping stEDU to wstEDU
   - Unwrapping wstEDU to stEDU
   - Reward distribution and rebasing

2. **Advanced Scenarios**
   - Full cycle tests with multiple users
   - Multiple reward distributions
   - Various user interactions over time

3. **Edge Cases and Security**
   - Math precision tests (small and large amounts)
   - Reentrancy protection
   - State consistency validation
   - Gas optimization checks
   - Extreme supply and reward scenarios

## Running the Tests

### Using NPM Scripts

The following npm scripts are available:

```bash
# Run all tests
npm test

# Run all tests with detailed output
npm run test:all

# Run specific test files
npm run test:stedu      # stEDU unit tests
npm run test:wstedu     # wstEDU unit tests
npm run test:integration # Integration tests
npm run test:fullcycle  # Full cycle scenario tests
npm run test:edgecases  # Edge cases and security tests
```

### Using the Custom Test Runner

You can also use the custom test runner script:

```bash
# Run all tests
node test/run-tests.js

# Run tests matching a specific name
node test/run-tests.js stedu
node test/run-tests.js integration

# List all available test files
node test/run-tests.js --list

# Show help
node test/run-tests.js --help
```

## Test Helpers

The `helpers.js` file provides utility functions used across the test suite:

- `deployContracts()` - Deploys stEDU and wstEDU contracts
- `stakeEDU()` - Helper to stake EDU
- `unstakeEDU()` - Helper to unstake stEDU
- `depositRewards()` - Helper to deposit rewards
- `wrapStEDU()` - Helper to wrap stEDU to wstEDU
- `unwrapWstEDU()` - Helper to unwrap wstEDU to stEDU
- Various calculation functions for expected values

## Extended Full Cycle Test

The extended full cycle test in `fullcycle.test.js` simulates a realistic environment with:

1. Multiple users (6 different wallet addresses)
2. Multiple reward distributions (3 reward events)
3. Various user actions:
   - Some users stake different amounts of EDU
   - Some users wrap to wstEDU, then unwrap later
   - Some users wrap, then unwrap only a portion
   - Some users stake additional EDU after rewards distribution
   - Some users unstake partial amounts at different times

The test follows this timeline:
- T0: Initial staking from multiple users
- T1: First reward distribution
- T2: Some wrapping, new staking
- T3: Second reward distribution (larger amount)
- T4: Some users unstake, others wrap more
- T5: Third reward distribution
- T6: Final unwrapping and unstaking

Throughout the test, state consistency is validated to ensure the contracts are functioning correctly.

## Edge Cases and Security Tests

The edge cases tests in `edgecases.test.js` cover:

1. **Math Precision**
   - Testing with very small amounts (1 wei)
   - Testing with very large amounts
   - Testing with various index values

2. **Reentrancy Protection**
   - Testing unstaking to a malicious contract
   - Testing admin withdrawals to a malicious contract

3. **State Consistency**
   - Testing that totalStaked and lastRecordedBalance remain consistent
   - Testing that contract balance matches lastRecordedBalance

4. **Gas Limits**
   - Testing with many users to ensure no gas limit issues

5. **Token Supply**
   - Testing extreme cases of supply expansion through rewards

## MaliciousReceiver Contract

The `MaliciousReceiver.sol` contract is used for testing reentrancy protection. It attempts to call back into the stEDU contract during the execution of unstake or adminWithdraw functions.
