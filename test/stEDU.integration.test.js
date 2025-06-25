const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  INITIAL_INDEX,
  UNSTAKE_DELAY,
  ONE_EDU,
  TEN_EDU,
  HUNDRED_EDU,
  deployContracts,
  advanceTime,
  advanceTimeAfterUnstakeDelay,
  calculateStEDUAmount,
  calculateEDUAmount,
  calculateIndexIncrease,
  formatBigInt
} = require("./helpers");

describe("stEDU Integration Tests", function () {
  let mockWEDU;
  let stEDU;
  let owner;
  let users;

  beforeEach(async function () {
    const contracts = await deployContracts();
    mockWEDU = contracts.mockWEDU;
    stEDU = contracts.stEDU;
    owner = contracts.owner;
    users = contracts.users;
  });

  describe("Full Cycle with Multiple Users", function () {
    it("Should handle stake → rewards → unstake cycle for multiple users", async function () {
      console.log("\n=== MULTI-USER FULL CYCLE TEST ===");
      console.log("Initial index:", ethers.formatEther(INITIAL_INDEX));
      
      // Define stake amounts for each user
      const stakeAmounts = [
        ethers.parseEther("50"),    // User 1: 50 EDU
        ethers.parseEther("100"),   // User 2: 100 EDU
        ethers.parseEther("25"),    // User 3: 25 EDU
        ethers.parseEther("75"),    // User 4: 75 EDU
        ethers.parseEther("200"),   // User 5: 200 EDU
      ];
      
      // Total staked amount
      const totalStaked = stakeAmounts.reduce((a, b) => a + b, 0n);
      
      // Step 1: All users stake EDU
      console.log("\n--- STEP 1: Users stake EDU ---");
      const userStEDUBalances = [];
      
      for (let i = 0; i < 5; i++) {
        const user = users[i];
        const stakeAmount = stakeAmounts[i];
        
        // Stake EDU
        await stEDU.connect(user).stake({ value: stakeAmount });
        
        // Get stEDU balance
        const stEDUBalance = await stEDU.balanceOf(user.address);
        userStEDUBalances.push(stEDUBalance);
        
        console.log(`User ${i+1} staked ${ethers.formatEther(stakeAmount)} EDU and received ${ethers.formatEther(stEDUBalance)} stEDU`);
        
        // Verify stEDU amount is correct
        const expectedStEDUAmount = calculateStEDUAmount(stakeAmount, INITIAL_INDEX);
        expect(stEDUBalance).to.equal(expectedStEDUAmount);
      }
      
      console.log(`Total staked: ${ethers.formatEther(totalStaked)} EDU`);
      console.log(`Total supply: ${ethers.formatEther(await stEDU.totalSupply())} stEDU`);
      
      // Step 2: Deposit rewards
      console.log("\n--- STEP 2: Deposit rewards ---");
      const rewardAmount = ethers.parseEther("45");  // 45 EDU as rewards
      
      // Get initial index
      const initialIndex = await stEDU.index();
      console.log(`Initial index before rewards: ${ethers.formatEther(initialIndex)}`);
      
      // Deposit rewards
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });
      
      // Get new index
      const newIndex = await stEDU.index();
      console.log(`New index after rewards: ${ethers.formatEther(newIndex)}`);
      console.log(`Index increase: ${ethers.formatEther(newIndex - initialIndex)}`);
      
      // Calculate expected index increase
      const totalSupply = await stEDU.totalSupply();
      const expectedIndexIncrease = calculateIndexIncrease(rewardAmount, totalSupply);
      
      // Verify index increased by expected amount
      expect(newIndex - initialIndex).to.equal(expectedIndexIncrease);
      
      // Step 3: Check values after rewards
      console.log("\n--- STEP 3: Check values after rewards ---");
      
      // Check values for all users
      for (let i = 0; i < 5; i++) {
        const user = users[i];
        const stakeAmount = stakeAmounts[i];
        const stEDUBalance = await stEDU.balanceOf(user.address);
        const eduValue = await stEDU.stEDUToEDU(stEDUBalance);
        
        console.log(`User ${i+1} has ${ethers.formatEther(stEDUBalance)} stEDU`);
        console.log(`  Worth ${ethers.formatEther(eduValue)} EDU`);
        
        // Verify stEDU balance is unchanged
        expect(stEDUBalance).to.equal(userStEDUBalances[i]);
        
        // Verify EDU value has increased
        expect(eduValue).to.be.gt(stakeAmount);
        
        // Calculate expected EDU value
        const expectedEduValue = (stEDUBalance * newIndex) / ethers.parseEther("1");
        expect(eduValue).to.equal(expectedEduValue);
        
        // Calculate user's share of rewards
        const userPortion = stEDUBalance * ethers.parseEther("1") / totalSupply;
        const expectedReward = (rewardAmount * userPortion) / ethers.parseEther("1");
        const actualReward = eduValue - stakeAmount;
        
        console.log(`  Received ${ethers.formatEther(actualReward)} EDU in rewards`);
        expect(actualReward).to.be.closeTo(expectedReward, ethers.parseEther("0.000000001"));
      }
      
      // Step 4: Advance time and unstake
      console.log("\n--- STEP 4: Advance time and unstake ---");
      
      // Advance time past the unstake delay
      await advanceTimeAfterUnstakeDelay();
      
      // All users unstake
      for (let i = 0; i < 5; i++) {
        const user = users[i];
        const stEDUBalance = await stEDU.balanceOf(user.address);
        const eduValueBefore = await stEDU.stEDUToEDU(stEDUBalance);
        
        // Get initial EDU balance
        const initialEDUBalance = await ethers.provider.getBalance(user.address);
        
        // Unstake
        const unstakeTx = await stEDU.connect(user).unstake(stEDUBalance);
        const receipt = await unstakeTx.wait();
        const gasCost = receipt.gasUsed * receipt.gasPrice;
        
        // Get final EDU balance
        const finalEDUBalance = await ethers.provider.getBalance(user.address);
        const eduReceived = finalEDUBalance + gasCost - initialEDUBalance;
        
        console.log(`User ${i+1} unstaked ${ethers.formatEther(stEDUBalance)} stEDU`);
        console.log(`  Expected: ${ethers.formatEther(eduValueBefore)} EDU`);
        console.log(`  Received: ${ethers.formatEther(eduReceived)} EDU`);
        
        // Verify received EDU matches expected value
        expect(eduReceived).to.be.closeTo(eduValueBefore, 10n);
      }
      
      // Verify final state
      console.log("\n--- FINAL STATE ---");
      console.log(`Total supply: ${ethers.formatEther(await stEDU.totalSupply())} stEDU`);
      console.log(`Final index: ${ethers.formatEther(await stEDU.index())}`);
      
      // Verify all stEDU has been unstaked
      expect(await stEDU.totalSupply()).to.equal(0);
      
      // Calculate APY based on index change
      // const indexRatio = Number(newIndex) / Number(initialIndex);
      // // Assuming 1 day elapsed for this test
      // const annualizedRatio = Math.pow(indexRatio, 365);
      // const apy = (annualizedRatio - 1) * 100;
      
      // console.log(`\nSimulated APY (if rewards were daily): ${apy.toFixed(2)}%`);
    });
  });

  describe("Wrap → Rewards → Unwrap Cycle", function () {
    it("Should handle stake → rewards → unstake with multiple deposits correctly", async function () {
      // User makes multiple deposits at different times
      const user = users[0];
      const firstStakeAmount = TEN_EDU;
      const secondStakeAmount = HUNDRED_EDU;
      
      // First stake
      await stEDU.connect(user).stake({ value: firstStakeAmount });
      const firstStEDUAmount = calculateStEDUAmount(firstStakeAmount, INITIAL_INDEX);
      
      // Advance time partially (not enough to unlock)
      await advanceTime(UNSTAKE_DELAY / 2);
      
      // Second stake
      await stEDU.connect(user).stake({ value: secondStakeAmount });
      const secondStEDUAmount = calculateStEDUAmount(secondStakeAmount, INITIAL_INDEX);
      
      // Deposit rewards
      const rewardAmount = TEN_EDU;
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });
      
      // Get new index
      const newIndex = await stEDU.index();
      
      // Advance time to unlock first deposit but not second
      await advanceTime(UNSTAKE_DELAY / 2 + 1);
      
      // Try to unstake all (should fail because second deposit is still locked)
      await expect(stEDU.connect(user).unstake(firstStEDUAmount + secondStEDUAmount))
        .to.be.revertedWith("Requested amount still locked");
      
      // Unstake only the first deposit amount (should succeed)
      const firstEDUValue = await stEDU.stEDUToEDU(firstStEDUAmount);
      
      // Get initial EDU balance
      const initialEDUBalance = await ethers.provider.getBalance(user.address);
      
      // Unstake first deposit
      const unstakeTx = await stEDU.connect(user).unstake(firstStEDUAmount);
      const receipt = await unstakeTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      // Get final EDU balance
      const finalEDUBalance = await ethers.provider.getBalance(user.address);
      const eduReceived = finalEDUBalance + gasCost - initialEDUBalance;
      
      // Verify received EDU matches expected value
      expect(eduReceived).to.be.closeTo(firstEDUValue, 10n);
      
      // Check remaining balance
      const remainingBalance = await stEDU.balanceOf(user.address);
      expect(remainingBalance).to.equal(secondStEDUAmount);
      
      // Advance time to unlock second deposit
      await advanceTime(UNSTAKE_DELAY / 2 + 1);
      
      // Unstake remaining amount
      await stEDU.connect(user).unstake(secondStEDUAmount);
      
      // Check final balance
      const finalStEDUBalance = await stEDU.balanceOf(user.address);
      expect(finalStEDUBalance).to.equal(0);
    });
  });
});
