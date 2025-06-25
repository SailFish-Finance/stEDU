// scripts/verify.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = network.name;
  console.log(`Starting contract verification on ${networkName} network...`);
  
  // Get deployment info
  const deploymentInfo = getDeploymentInfo(networkName);
  if (!deploymentInfo) {
    console.error(`No deployment info found for ${networkName} network.`);
    console.log("Please run the deployment script first or provide contract addresses manually.");
    return;
  }
  
  const { mockWEDU: mockWEDUAddress, stEDU: stEDUAddress } = deploymentInfo.addresses;
  
  // Verify MockWEDU contract
  console.log(`\nVerifying MockWEDU contract at ${mockWEDUAddress}...`);
  try {
    await hre.run("verify:verify", {
      address: mockWEDUAddress,
      constructorArguments: [],
    });
    console.log("MockWEDU contract verified successfully!");
  } catch (error) {
    console.error("Error verifying MockWEDU contract:", error.message);
    if (error.message.includes("already verified")) {
      console.log("MockWEDU contract is already verified.");
    }
  }
  
  // Verify stEDU contract
  console.log(`\nVerifying stEDU contract at ${stEDUAddress}...`);
  try {
    await hre.run("verify:verify", {
      address: stEDUAddress,
      constructorArguments: [mockWEDUAddress],
    });
    console.log("stEDU contract verified successfully!");
  } catch (error) {
    console.error("Error verifying stEDU contract:", error.message);
    if (error.message.includes("already verified")) {
      console.log("stEDU contract is already verified.");
    }
  }
  
  // Summary
  console.log("\n=== Verification Summary ===");
  console.log("Network:", networkName);
  console.log("MockWEDU:", mockWEDUAddress);
  console.log("stEDU:", stEDUAddress);
  console.log("Explorer URL:", getExplorerURL(networkName));
  
  console.log("\nVerification process completed!");
}

// Helper function to get deployment info from file
function getDeploymentInfo(networkName) {
  try {
    const filePath = path.join(__dirname, "../deployments", `${networkName}.json`);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      return JSON.parse(fileContent);
    }
    return null;
  } catch (error) {
    console.error("Error reading deployment info:", error.message);
    return null;
  }
}

// Helper function to get explorer URL based on network
function getExplorerURL(networkName) {
  if (networkName === "opencampus") {
    return "https://edu-chain-testnet.blockscout.com/";
  } else if (networkName === "educhain") {
    return "https://educhain.blockscout.com/";
  } else {
    return "Explorer URL not available for this network";
  }
}

// Execute the verification
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
