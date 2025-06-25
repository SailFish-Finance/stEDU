// scripts/interact.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = network.name;
  console.log(`Starting interaction with contracts on ${networkName} network...`);
  
  // Get deployment info
  const deploymentInfo = getDeploymentInfo(networkName);
  if (!deploymentInfo) {
    console.error(`No deployment info found for ${networkName} network.`);
    console.log("Please run the deployment script first or provide contract addresses manually.");
    return;
  }
  
  const { mockWEDU: mockWEDUAddress, stEDU: stEDUAddress } = deploymentInfo.addresses;
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Interacting with contracts using account: ${signer.address}`);
  
  // Get initial balance
  const initialBalance = await ethers.provider.getBalance(signer.address);
  console.log(`Initial EDU balance: ${ethers.formatEther(initialBalance)} EDU`);
  
  // Get contract instances
  const stEDU = await ethers.getContractAt("stEDU", stEDUAddress);
  const mockWEDU = await ethers.getContractAt("MockWEDU", mockWEDUAddress);
  
  // Check if signer is the owner of stEDU
  const owner = await stEDU.owner();
  const isOwner = owner.toLowerCase() === signer.address.toLowerCase();
  console.log(`Is signer the owner of stEDU? ${isOwner}`);
  
  // Get initial contract state
  console.log("\n=== Initial Contract State ===");
  await logContractState(stEDU, mockWEDU, signer.address);
  
  // Step 1: Stake EDU to get stEDU
  console.log("\n=== Step 1: Staking EDU ===");
  const stakeAmount = ethers.parseEther("0.1"); // Stake 0.1 EDU
  console.log(`Staking ${ethers.formatEther(stakeAmount)} EDU...`);
  
  try {
    const stakeTx = await stEDU.stake({ value: stakeAmount });
    await stakeTx.wait();
    console.log("Staking successful!");
    
    // Get stEDU balance after staking
    const stEDUBalance = await stEDU.balanceOf(signer.address);
    console.log(`stEDU balance after staking: ${ethers.formatEther(stEDUBalance)} stEDU`);
  } catch (error) {
    console.error("Error staking EDU:", error.message);
  }
  
  // Step 2: Deposit rewards (if owner)
  console.log("\n=== Step 2: Depositing Rewards ===");
  if (isOwner) {
    try {
      const rewardAmount = ethers.parseEther("0.01"); // 0.01 EDU as rewards
      console.log(`Depositing ${ethers.formatEther(rewardAmount)} EDU as rewards...`);
      const rewardTx = await stEDU.depositRewards({ value: rewardAmount });
      await rewardTx.wait();
      console.log("Rewards deposited successfully!");
      
      // Get new index
      const newIndex = await stEDU.index();
      console.log(`New index after rewards: ${ethers.formatEther(newIndex)}`);
    } catch (error) {
      console.error("Error depositing rewards:", error.message);
    }
  } else {
    console.log("Skipping reward deposit as signer is not the owner.");
  }
  
  // Step 3: Unstake stEDU to get EDU
  console.log("\n=== Step 3: Unstaking stEDU ===");
  try {
    // Get current stEDU balance
    const stEDUBalance = await stEDU.balanceOf(signer.address);
    if (stEDUBalance > 0n) {
      console.log(`Unstaking ${ethers.formatEther(stEDUBalance)} stEDU...`);
      
      // Check if unstaking is possible (might need to wait for unbonding period)
      try {
        const unstakeTx = await stEDU.unstake(stEDUBalance);
        await unstakeTx.wait();
        console.log("Unstaking successful!");
      } catch (error) {
        if (error.message.includes("Requested amount still locked")) {
          console.log("Cannot unstake yet due to unbonding period. You need to wait before unstaking.");
        } else {
          throw error;
        }
      }
    } else {
      console.log("No stEDU balance to unstake.");
    }
  } catch (error) {
    console.error("Error unstaking stEDU:", error.message);
  }
  
  // Get final contract state
  console.log("\n=== Final Contract State ===");
  await logContractState(stEDU, mockWEDU, signer.address);
  
  // Get final balance
  const finalBalance = await ethers.provider.getBalance(signer.address);
  console.log(`\nFinal EDU balance: ${ethers.formatEther(finalBalance)} EDU`);
  console.log(`Change in EDU balance: ${ethers.formatEther(finalBalance - initialBalance)} EDU`);
  
  console.log("\nInteraction complete!");
}

// Helper function to log contract state
async function logContractState(stEDU, mockWEDU, address) {
  // stEDU state
  const stEDUTotalSupply = await stEDU.totalSupply();
  const stEDUBalance = await stEDU.balanceOf(address);
  const index = await stEDU.index();
  
  // MockWEDU state
  const mockWEDUTotalSupply = await mockWEDU.totalSupply();
  const mockWEDUBalance = await mockWEDU.balanceOf(address);
  
  // Log state
  console.log("stEDU Total Supply:", ethers.formatEther(stEDUTotalSupply), "stEDU");
  console.log("stEDU Balance:", ethers.formatEther(stEDUBalance), "stEDU");
  console.log("Current Index:", ethers.formatEther(index));
  console.log("MockWEDU Total Supply:", ethers.formatEther(mockWEDUTotalSupply), "WEDU");
  console.log("MockWEDU Balance:", ethers.formatEther(mockWEDUBalance), "WEDU");
  
  // Calculate EDU values
  if (stEDUBalance > 0n) {
    const stEDUValue = await stEDU.stEDUToEDU(stEDUBalance);
    console.log("stEDU Value in EDU:", ethers.formatEther(stEDUValue), "EDU");
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

// Execute the interaction
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
