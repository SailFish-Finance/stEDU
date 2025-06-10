const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  deployContracts,
  stakeEDU,
  unstakeEDU,
  depositRewards,
  wrapStEDU,
  unwrapWstEDU,
  calculateStEDUAmount,
  calculateEDUAmount
} = require("./helpers");

describe("Multi-User Rewards Test", function () {
  let stEDU;
  let wstEDU;
  let owner;
  let users;

  beforeEach(async function () {
    const contracts = await deployContracts();
    stEDU = contracts.stEDU;
    wstEDU = contracts.wstEDU;
    owner = contracts.owner;
    users = contracts.users;
  });

  it("Should handle multiple users staking with rewards distributed in between", async function () {
    console.log("\n--- MULTI-USER REWARDS TEST ---");
    
    // Use 5 users
    const testUsers = users.slice(0, 5);
    
    // Log user addresses
    console.log("User addresses:");
    for (let i = 0; i < testUsers.length; i++) {
      console.log(`User ${i + 1}: ${testUsers[i].address}`);
    }
    
    // Initial stake amounts for each user (different amounts)
    const stakeAmounts = [
      ethers.parseEther("100"),  // User 1: 100 EDU
      ethers.parseEther("50"),   // User 2: 50 EDU
      ethers.parseEther("200"),  // User 3: 200 EDU
      ethers.parseEther("75"),   // User 4: 75 EDU
      ethers.parseEther("150")   // User 5: 150 EDU
    ];
    
    // Reward amounts for 3 distributions
    const rewardAmounts = [
      ethers.parseEther("20"),   // First reward: 20 EDU
      ethers.parseEther("30"),   // Second reward: 30 EDU
      ethers.parseEther("50")    // Third reward: 50 EDU
    ];
    
    // Track user balances and conversion values
    const userBalances = [];
    const conversionValues = [];
    
    // Initial stake for all users
    console.log("\n--- INITIAL STAKING ---");
    for (let i = 0; i < testUsers.length; i++) {
      console.log(`\nUser ${i + 1} staking ${ethers.formatEther(stakeAmounts[i])} EDU`);
      await stakeEDU(stEDU, testUsers[i], stakeAmounts[i]);
      
      const stEDUBalance = await stEDU.balanceOf(testUsers[i].address);
      console.log(`stEDU balance: ${ethers.formatEther(stEDUBalance)}`);
      
      // Approve and wrap half of stEDU
      const wrapAmount = stEDUBalance / BigInt(2);
      await stEDU.connect(testUsers[i]).approve(await wstEDU.getAddress(), wrapAmount);
      await wstEDU.connect(testUsers[i]).wrap(wrapAmount);
      
      const remainingStEDU = await stEDU.balanceOf(testUsers[i].address);
      const wstEDUBalance = await wstEDU.balanceOf(testUsers[i].address);
      
      console.log(`Wrapped half of stEDU:`);
      console.log(`  - Remaining stEDU: ${ethers.formatEther(remainingStEDU)}`);
      console.log(`  - wstEDU balance: ${ethers.formatEther(wstEDUBalance)}`);
      
      // Store initial balances
      userBalances.push({
        user: i + 1,
        stEDU: remainingStEDU,
        wstEDU: wstEDUBalance
      });
      
      // Store initial conversion values
      conversionValues.push({
        user: i + 1,
        stEDUToEDU: await stEDU.stEDUToEDU(remainingStEDU),
        wstEDUToEDU: await wstEDU.wstEDUToEDU(wstEDUBalance)
      });
    }
    
    // First reward distribution
    console.log("\n--- FIRST REWARD DISTRIBUTION ---");
    console.log(`Depositing ${ethers.formatEther(rewardAmounts[0])} EDU as rewards`);
    await depositRewards(stEDU, owner, rewardAmounts[0]);
    
    // Check conversion values after first reward
    console.log("\nConversion values after first reward:");
    for (let i = 0; i < testUsers.length; i++) {
      const stEDUBalance = userBalances[i].stEDU;
      const wstEDUBalance = userBalances[i].wstEDU;
      
      const stEDUToEDU = await stEDU.stEDUToEDU(stEDUBalance);
      const wstEDUToEDU = await wstEDU.wstEDUToEDU(wstEDUBalance);
      
      const stEDUDiff = stEDUToEDU - conversionValues[i].stEDUToEDU;
      const wstEDUDiff = wstEDUToEDU - conversionValues[i].wstEDUToEDU;
      
      console.log(`\nUser ${i + 1}:`);
      console.log(`  - stEDU (${ethers.formatEther(stEDUBalance)}) value: ${ethers.formatEther(stEDUToEDU)} EDU`);
      console.log(`    Increase: ${ethers.formatEther(stEDUDiff)} EDU`);
      console.log(`  - wstEDU (${ethers.formatEther(wstEDUBalance)}) value: ${ethers.formatEther(wstEDUToEDU)} EDU`);
      console.log(`    Increase: ${ethers.formatEther(wstEDUDiff)} EDU`);
      
      // Update conversion values
      conversionValues[i].stEDUToEDU = stEDUToEDU;
      conversionValues[i].wstEDUToEDU = wstEDUToEDU;
    }
    
    // Second reward distribution
    console.log("\n--- SECOND REWARD DISTRIBUTION ---");
    console.log(`Depositing ${ethers.formatEther(rewardAmounts[1])} EDU as rewards`);
    await depositRewards(stEDU, owner, rewardAmounts[1]);
    
    // Check conversion values after second reward
    console.log("\nConversion values after second reward:");
    for (let i = 0; i < testUsers.length; i++) {
      const stEDUBalance = userBalances[i].stEDU;
      const wstEDUBalance = userBalances[i].wstEDU;
      
      const stEDUToEDU = await stEDU.stEDUToEDU(stEDUBalance);
      const wstEDUToEDU = await wstEDU.wstEDUToEDU(wstEDUBalance);
      
      const stEDUDiff = stEDUToEDU - conversionValues[i].stEDUToEDU;
      const wstEDUDiff = wstEDUToEDU - conversionValues[i].wstEDUToEDU;
      
      console.log(`\nUser ${i + 1}:`);
      console.log(`  - stEDU (${ethers.formatEther(stEDUBalance)}) value: ${ethers.formatEther(stEDUToEDU)} EDU`);
      console.log(`    Increase: ${ethers.formatEther(stEDUDiff)} EDU`);
      console.log(`  - wstEDU (${ethers.formatEther(wstEDUBalance)}) value: ${ethers.formatEther(wstEDUToEDU)} EDU`);
      console.log(`    Increase: ${ethers.formatEther(wstEDUDiff)} EDU`);
      
      // Update conversion values
      conversionValues[i].stEDUToEDU = stEDUToEDU;
      conversionValues[i].wstEDUToEDU = wstEDUToEDU;
    }
    
    // Third reward distribution
    console.log("\n--- THIRD REWARD DISTRIBUTION ---");
    console.log(`Depositing ${ethers.formatEther(rewardAmounts[2])} EDU as rewards`);
    await depositRewards(stEDU, owner, rewardAmounts[2]);
    
    // Check conversion values after third reward
    console.log("\nConversion values after third reward:");
    for (let i = 0; i < testUsers.length; i++) {
      const stEDUBalance = userBalances[i].stEDU;
      const wstEDUBalance = userBalances[i].wstEDU;
      
      const stEDUToEDU = await stEDU.stEDUToEDU(stEDUBalance);
      const wstEDUToEDU = await wstEDU.wstEDUToEDU(wstEDUBalance);
      
      const stEDUDiff = stEDUToEDU - conversionValues[i].stEDUToEDU;
      const wstEDUDiff = wstEDUToEDU - conversionValues[i].wstEDUToEDU;
      
      console.log(`\nUser ${i + 1}:`);
      console.log(`  - stEDU (${ethers.formatEther(stEDUBalance)}) value: ${ethers.formatEther(stEDUToEDU)} EDU`);
      console.log(`    Increase: ${ethers.formatEther(stEDUDiff)} EDU`);
      console.log(`  - wstEDU (${ethers.formatEther(wstEDUBalance)}) value: ${ethers.formatEther(wstEDUToEDU)} EDU`);
      console.log(`    Increase: ${ethers.formatEther(wstEDUDiff)} EDU`);
      
      // Update conversion values
      conversionValues[i].stEDUToEDU = stEDUToEDU;
      conversionValues[i].wstEDUToEDU = wstEDUToEDU;
    }
    
    // Unwrap and unstake for all users
    console.log("\n--- UNWRAP AND UNSTAKE ---");
    for (let i = 0; i < testUsers.length; i++) {
      console.log(`\nUser ${i + 1}:`);
      
      // Unwrap wstEDU
      const wstEDUBalance = userBalances[i].wstEDU;
      console.log(`Unwrapping ${ethers.formatEther(wstEDUBalance)} wstEDU`);
      
      // Get predicted stEDU amount
      const predictedStEDUAmount = await wstEDU.getStEDUAmount(wstEDUBalance);
      console.log(`Predicted stEDU amount: ${ethers.formatEther(predictedStEDUAmount)}`);
      
      // Unwrap
      await wstEDU.connect(testUsers[i]).unwrap(wstEDUBalance);
      
      // Get actual stEDU amount
      const actualStEDUAmount = await stEDU.balanceOf(testUsers[i].address) - userBalances[i].stEDU;
      console.log(`Actual stEDU amount: ${ethers.formatEther(actualStEDUAmount)}`);
      console.log(`Difference: ${ethers.formatEther(actualStEDUAmount - predictedStEDUAmount)}`);
      
      // Verify prediction matches actual
      expect(actualStEDUAmount).to.equal(predictedStEDUAmount);
      
      // Get total stEDU balance
      const totalStEDUBalance = await stEDU.balanceOf(testUsers[i].address);
      
      // Get predicted EDU value
      const predictedEDUValue = await stEDU.stEDUToEDU(totalStEDUBalance);
      console.log(`\nUnstaking ${ethers.formatEther(totalStEDUBalance)} stEDU`);
      console.log(`Predicted EDU value: ${ethers.formatEther(predictedEDUValue)}`);
      
      // Get initial balance
      const initialBalance = await ethers.provider.getBalance(testUsers[i].address);
      
      // Unstake
      const unstakeTx = await stEDU.connect(testUsers[i]).unstake(totalStEDUBalance);
      const receipt = await unstakeTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      // Get final balance
      const finalBalance = await ethers.provider.getBalance(testUsers[i].address);
      
      // Calculate actual EDU received
      const actualEDUReceived = finalBalance + gasCost - initialBalance;
      console.log(`Actual EDU received: ${ethers.formatEther(actualEDUReceived)}`);
      console.log(`Difference: ${ethers.formatEther(actualEDUReceived - predictedEDUValue)}`);
      
      // Verify prediction matches actual
      expect(predictedEDUValue).to.be.closeTo(actualEDUReceived, ethers.parseEther("0.0001"));
    }
    
    // Verify final state
    const finalTotalSupply = await stEDU.totalSupply();
    const finalTotalStaked = await stEDU.totalStaked();
    
    console.log("\n--- FINAL STATE ---");
    console.log(`Total supply: ${ethers.formatEther(finalTotalSupply)}`);
    console.log(`Total staked: ${ethers.formatEther(finalTotalStaked)}`);
    
    expect(finalTotalSupply).to.equal(0);
    expect(finalTotalStaked).to.equal(0);
  });
});
