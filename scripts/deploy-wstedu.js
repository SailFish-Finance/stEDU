// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  console.log("Starting deployment to", network.name, "network...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    "Account balance:",
    (await ethers.provider.getBalance(deployer.address)).toString()
  );

  
  // Deploy MockWEDU contract first
  console.log("\nDeploying wstEDU contract...");
  const WstEDU = await ethers.getContractFactory("wstEDU");
  const wstEDU = await WstEDU.deploy("0x0324da014FC0911502766CAaa740D861634b82b9");
  await wstEDU.waitForDeployment();

  const wstEDUAddress = await wstEDU.getAddress();
  console.log("wstEDU deployed to:", wstEDUAddress);

  // Summary
  console.log("\n=== Deployment Summary ===");
  console.log("Network:", network.name);
  console.log("wstEDUAddress:", wstEDUAddress);
  console.log("Explorer URL:", getExplorerURL(network.name));
  
  // Save deployment info to a file for verification script
  saveDeploymentInfo(network.name, {
    wstEDUAddress: wstEDUAddress,
  });

  console.log("\nDeployment complete!");
  console.log(
    "To verify contracts, run: npx hardhat run scripts/verify.js --network",
    network.name
  );
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

// Helper function to save deployment info to a file
function saveDeploymentInfo(networkName, addresses) {
  const fs = require("fs");
  const path = require("path");

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // Save deployment info to a JSON file
  const filePath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        network: networkName,
        addresses,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log(`Deployment info saved to ${filePath}`);
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
