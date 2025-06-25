// scripts/manual-verify.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// This script helps with manual verification by providing the necessary information
// to verify contracts on the blockchain explorer if automatic verification fails.

async function main() {
  const networkName = network.name;
  console.log(`Preparing manual verification info for ${networkName} network...`);
  
  // Get deployment info
  const deploymentInfo = getDeploymentInfo(networkName);
  if (!deploymentInfo) {
    console.error(`No deployment info found for ${networkName} network.`);
    console.log("Please provide contract addresses manually:");
    console.log("stEDU address: ");
    console.log("wstEDU address: ");
    return;
  }
  
  const { stEDU: stEDUAddress, wstEDU: wstEDUAddress } = deploymentInfo.addresses;
  
  // Get explorer URL
  const explorerURL = getExplorerURL(networkName);
  
  // Get contract source code and ABI
  const stEDUArtifact = await getContractArtifact("stEDU");
  const wstEDUArtifact = await getContractArtifact("wstEDU");
  
  if (!stEDUArtifact || !wstEDUArtifact) {
    console.error("Failed to get contract artifacts. Make sure contracts are compiled.");
    return;
  }
  
  // Create manual verification info
  const manualVerificationInfo = {
    network: networkName,
    explorerURL,
    contracts: {
      stEDU: {
        address: stEDUAddress,
        constructorArguments: [],
        contractName: "stEDU",
        compilerVersion: stEDUArtifact.metadata ? JSON.parse(stEDUArtifact.metadata).compiler.version : "Unknown",
        optimizationUsed: true,
        runs: 200
      },
      wstEDU: {
        address: wstEDUAddress,
        constructorArguments: [stEDUAddress],
        contractName: "wstEDU",
        compilerVersion: wstEDUArtifact.metadata ? JSON.parse(wstEDUArtifact.metadata).compiler.version : "Unknown",
        optimizationUsed: true,
        runs: 200
      }
    }
  };
  
  // Save manual verification info to a file
  saveManualVerificationInfo(networkName, manualVerificationInfo);
  
  // Print manual verification instructions
  console.log("\n=== Manual Verification Instructions ===");
  console.log(`Explorer URL: ${explorerURL}`);
  
  console.log("\n1. For stEDU contract:");
  console.log(`   Address: ${stEDUAddress}`);
  console.log("   Constructor Arguments (ABI-encoded): []");
  console.log(`   Compiler Version: ${manualVerificationInfo.contracts.stEDU.compilerVersion}`);
  console.log("   Optimization: Yes");
  console.log("   Optimization Runs: 200");
  
  console.log("\n2. For wstEDU contract:");
  console.log(`   Address: ${wstEDUAddress}`);
  console.log(`   Constructor Arguments (ABI-encoded): ${encodeConstructorArgs(["address"], [stEDUAddress])}`);
  console.log(`   Compiler Version: ${manualVerificationInfo.contracts.wstEDU.compilerVersion}`);
  console.log("   Optimization: Yes");
  console.log("   Optimization Runs: 200");
  
  console.log("\nTo manually verify contracts:");
  console.log(`1. Go to ${explorerURL}`);
  console.log("2. Search for the contract address");
  console.log("3. Click on the 'Code' tab");
  console.log("4. Click on 'Verify & Publish'");
  console.log("5. Fill in the form with the information provided above");
  console.log("6. Submit the form");
  
  console.log("\nManual verification info has been saved to:");
  console.log(`${path.join(__dirname, "../deployments", `${networkName}-manual-verify.json`)}`);
}

// Helper function to get contract artifact
async function getContractArtifact(contractName) {
  try {
    const artifactPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);
    if (fs.existsSync(artifactPath)) {
      const artifactContent = fs.readFileSync(artifactPath, "utf8");
      return JSON.parse(artifactContent);
    }
    return null;
  } catch (error) {
    console.error(`Error reading artifact for ${contractName}:`, error.message);
    return null;
  }
}

// Helper function to encode constructor arguments
function encodeConstructorArgs(types, values) {
  try {
    const abiCoder = new ethers.AbiCoder();
    return abiCoder.encode(types, values);
  } catch (error) {
    console.error("Error encoding constructor arguments:", error.message);
    return "Error encoding constructor arguments";
  }
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

// Helper function to save manual verification info to a file
function saveManualVerificationInfo(networkName, info) {
  try {
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir);
    }
    
    const filePath = path.join(deploymentsDir, `${networkName}-manual-verify.json`);
    fs.writeFileSync(
      filePath,
      JSON.stringify(info, null, 2)
    );
    
    console.log(`Manual verification info saved to ${filePath}`);
  } catch (error) {
    console.error("Error saving manual verification info:", error.message);
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

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
