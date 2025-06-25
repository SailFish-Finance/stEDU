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
  console.log("\nDeploying MockWEDU contract...");
  const MockWEDU = await ethers.getContractFactory("MockWEDU");
  const mockWEDU = await MockWEDU.deploy();
  await mockWEDU.waitForDeployment();

  const mockWEDUAddress = await mockWEDU.getAddress();
  console.log("MockWEDU deployed to:", mockWEDUAddress);

  // Deploy stEDU contract with MockWEDU address
  console.log("\nDeploying stEDU contract...");
  const StEDU = await ethers.getContractFactory("stEDU");
  const stEDU = await StEDU.deploy(mockWEDUAddress);
  await stEDU.waitForDeployment();

  const stEDUAddress = await stEDU.getAddress();
  console.log("stEDU deployed to:", stEDUAddress);

  // Summary
  console.log("\n=== Deployment Summary ===");
  console.log("Network:", network.name);
  console.log("MockWEDU:", mockWEDUAddress);
  console.log("stEDU:", stEDUAddress);
  console.log("Explorer URL:", getExplorerURL(network.name));
  
  // Save deployment info to a file for verification script
  saveDeploymentInfo(network.name, {
    mockWEDU: mockWEDUAddress,
    stEDU: stEDUAddress
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
