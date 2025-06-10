// We require the Hardhat Runtime Environment explicitly here.
const hre = require("hardhat");

async function main() {
  console.log("Deploying stEDU and wstEDU contracts to", hre.network.name);

  // Deploy stEDU contract
  const StEDU = await hre.ethers.getContractFactory("stEDU");
  const stEDU = await StEDU.deploy();
  await stEDU.waitForDeployment();
  const stEDUAddress = await stEDU.getAddress();
  console.log(`stEDU deployed to: ${stEDUAddress}`);

  // Deploy wstEDU contract with stEDU address
  const WstEDU = await hre.ethers.getContractFactory("wstEDU");
  const wstEDU = await WstEDU.deploy(stEDUAddress);
  await wstEDU.waitForDeployment();
  const wstEDUAddress = await wstEDU.getAddress();
  console.log(`wstEDU deployed to: ${wstEDUAddress}`);

  console.log("Deployment complete!");
  console.log("Contract addresses:");
  console.log(`- stEDU: ${stEDUAddress}`);
  console.log(`- wstEDU: ${wstEDUAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
