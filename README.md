# stEDU & wstEDU on EDUCHAIN

This repo contains the smart contracts for:

- `stEDU`: a index-share-mode using wstETH pattern


## Build

1. Compile:
   ```bash
   npx hardhat compile
   ```

2. Deploy stEDU:
   ```js
   const stEDU = await ethers.deployContract("stEDU");
   ```

3. Deploy wstEDU:
   ```js
   const wstEDU = await ethers.deployContract("wstEDU", [stEDU.address]);
   ```

4. Stake, wrap, and test rebase logic via:
   ```bash
   npx hardhat console
   ```
