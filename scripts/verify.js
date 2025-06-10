// We require the Hardhat Runtime Environment explicitly here.
const hre = require("hardhat");

async function main() {
  // Contract addresses from deployment
  const stEDUAddress = "0x121C0970eD215ED110F7Fb84e74e0067428C1F99";
  const wstEDUAddress = "0x761C38F39EA79221949B4628061711A19c8f7228";

  console.log(`Verifying stEDU contract at ${stEDUAddress}...`);
  try {
    await hre.run("verify:verify", {
      address: stEDUAddress,
      constructorArguments: [],
    });
    console.log("stEDU contract verified successfully!");
  } catch (error) {
    console.error("Error verifying stEDU contract:", error.message);
  }

  console.log(`Verifying wstEDU contract at ${wstEDUAddress}...`);
  try {
    await hre.run("verify:verify", {
      address: wstEDUAddress,
      constructorArguments: [stEDUAddress],
    });
    console.log("wstEDU contract verified successfully!");
  } catch (error) {
    console.error("Error verifying wstEDU contract:", error.message);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
