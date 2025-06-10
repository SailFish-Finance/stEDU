# stEDU & wstEDU Deployment Guide

This guide provides instructions for deploying, verifying, and interacting with the stEDU and wstEDU contracts on the opencampus network.

## Deployed Contracts

The contracts have been successfully deployed to the opencampus network:

- **stEDU**: [0x121C0970eD215ED110F7Fb84e74e0067428C1F99](https://edu-chain-testnet.blockscout.com/address/0x121C0970eD215ED110F7Fb84e74e0067428C1F99)
- **wstEDU**: [0x761C38F39EA79221949B4628061711A19c8f7228](https://edu-chain-testnet.blockscout.com/address/0x761C38F39EA79221949B4628061711A19c8f7228)

Both contracts have been verified on the blockchain explorer and their source code is publicly viewable.

## Deployment Process

The deployment process involves the following steps:

1. **Setup Environment**:
   - Ensure you have Node.js and npm installed
   - Install dependencies with `npm install`
   - Create a `.env` file with your private key: `PRIVATE_KEY=your_private_key_here`

2. **Deploy Contracts**:
   ```bash
   npx hardhat run scripts/deploy.js --network opencampus
   ```

3. **Verify Contracts**:
   ```bash
   npx hardhat run scripts/verify.js --network opencampus
   ```

## Interacting with Contracts

You can interact with the deployed contracts using the provided script:

```bash
npx hardhat run scripts/interact.js --network opencampus
```

This script performs the following operations:
- Stakes EDU to receive stEDU
- Wraps stEDU to wstEDU
- Deposits rewards (if the account is the owner)
- Unwraps wstEDU back to stEDU
- Unstakes stEDU to receive EDU

## Contract Functionality

### stEDU Contract

The stEDU contract is a rebasing ERC20 token that represents staked native EDU. Key functions:

- `stake()`: Stake native EDU and receive stEDU
- `unstake(uint256 stEDUAmount)`: Unstake and receive native EDU
- `depositRewards()`: Deposit native EDU as rewards and trigger a rebase
- `delegate(address delegatee)`: Delegate voting rights to another address
- `adminWithdraw(address payable to, uint256 amount)`: Admin function to withdraw funds

### wstEDU Contract

The wstEDU contract is a non-rebasing wrapped version of stEDU for DeFi use. Key functions:

- `wrap(uint256 stEDUAmount)`: Wrap stEDU into wstEDU
- `unwrap(uint256 wstEDUAmount)`: Unwrap wstEDU back into stEDU
- `stEDUPerToken()`: Get the current stEDU value of 1 wstEDU
- `eduValue(uint256 wstEDUAmount)`: Get current value in EDU for a given wstEDU amount

## Troubleshooting

If you encounter connection issues with the opencampus network, try the following:

1. Check if the RPC endpoint is available: `https://rpc.open-campus-codex.gelato.digital/`
2. Ensure you have sufficient EDU in your account for gas fees
3. Try again later as the network might be temporarily unavailable

## Notes

- The stEDU contract owner is the account that deployed the contract
- Only the owner can deposit rewards and trigger rebases
- The wstEDU contract maintains a constant balance while the value increases with rewards
