# stEDU & wstEDU Deployment Scripts

This directory contains scripts for deploying, verifying, and interacting with the stEDU and wstEDU contracts on the opencampus and educhain networks.

## Prerequisites

Before using these scripts, make sure you have:

1. Node.js and npm installed
2. Project dependencies installed with `npm install`
3. A `.env` file in the project root with your private key:
   ```
   PRIVATE_KEY=your_private_key_here
   ```
4. Sufficient EDU in your account for gas fees

## Available Scripts

### 1. Deploy Contracts (`deploy.js`)

Deploys the stEDU and wstEDU contracts to the specified network.

```bash
npx hardhat run scripts/deploy.js --network opencampus
# or
npx hardhat run scripts/deploy.js --network educhain
```

This script:
- Deploys the stEDU contract
- Deploys the wstEDU contract with the stEDU address as a constructor parameter
- Logs the deployed addresses
- Saves deployment information to a JSON file in the `deployments` directory

### 2. Verify Contracts (`verify.js`)

Verifies the deployed contracts on the blockchain explorer.

```bash
npx hardhat run scripts/verify.js --network opencampus
# or
npx hardhat run scripts/verify.js --network educhain
```

This script:
- Reads deployment information from the JSON file in the `deployments` directory
- Verifies the stEDU contract
- Verifies the wstEDU contract with its constructor arguments

### 3. Interact with Contracts (`interact.js`)

Demonstrates how to interact with the deployed contracts.

```bash
npx hardhat run scripts/interact.js --network opencampus
# or
npx hardhat run scripts/interact.js --network educhain
```

This script:
- Stakes EDU to receive stEDU
- Wraps stEDU to wstEDU
- Deposits rewards (if the account is the owner)
- Unwraps wstEDU back to stEDU
- Attempts to unstake stEDU to receive EDU (may be subject to unbonding period)

### 4. Manual Verification Helper (`manual-verify.js`)

Provides information for manually verifying contracts if automatic verification fails.

```bash
npx hardhat run scripts/manual-verify.js --network opencampus
# or
npx hardhat run scripts/manual-verify.js --network educhain
```

This script:
- Retrieves deployment information from the JSON file
- Extracts contract artifacts and compiler information
- Generates ABI-encoded constructor arguments
- Provides step-by-step instructions for manual verification
- Saves verification information to a JSON file in the `deployments` directory

### 5. Check Contract Status (`check-status.js`)

Checks the current status of deployed contracts and provides useful information.

```bash
npx hardhat run scripts/check-status.js --network opencampus
# or
npx hardhat run scripts/check-status.js --network educhain
```

This script:
- Verifies that contracts are deployed and have code
- Displays contract state (total supply, index, paused status, etc.)
- Shows user balances and their value in EDU
- Provides network information (block number, timestamp, etc.)
- Calculates estimated APY based on index changes since deployment
