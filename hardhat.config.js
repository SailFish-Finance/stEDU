require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    opencampus: {
      url: `https://rpc.open-campus-codex.gelato.digital/`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    educhain: {
      url: "https://rpc.edu-chain.raas.gelato.cloud",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 1000000000,
      gas: 80000000,
    },
  },
  etherscan: {
    apiKey: {
      opencampus: "your-etherscan-api-key",
      educhain: "your-etherscan-api-key",
    },
    customChains: [
      {
        network: "opencampus",
        chainId: 656476,
        urls: {
          apiURL: "https://edu-chain-testnet.blockscout.com/api/",
          browserURL: "https://edu-chain-testnet.blockscout.com/",
        },
      },
      {
        network: "educhain",
        chainId: 41923,
        urls: {
          apiURL: "https://educhain.blockscout.com/api/",
          browserURL: "https://educhain.blockscout.com/",
        },
      },
    ],
  },
};
