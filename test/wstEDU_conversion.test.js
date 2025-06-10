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

describe("wstEDU Conversion Functions", function () {
  let stEDU;
  let wstEDU;
  let owner;
  let users;
  const INITIAL_INDEX = BigInt(1e18);
  const ONE_EDU = ethers.parseEther("1");

  beforeEach(async function () {
    const contracts = await deployContracts();
    stEDU = contracts.stEDU;
    wstEDU = contracts.wstEDU;
    owner = contracts.owner;
    users = contracts.users;
  });

  describe("wstEDUToEDU Function", function () {
    it("Should return 0 when no wstEDU tokens exist", async function () {
      const result = await wstEDU.wstEDUToEDU(ONE_EDU);
      expect(result).to.equal(0);
    });

    it("Should match the actual EDU received when unwrapping and unstaking", async function () {
      const user = users[0];
      const stakeAmount = ethers.parseEther("100");
      
      // Stake EDU
      await stakeEDU(stEDU, user, stakeAmount);
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Approve and wrap stEDU
      await stEDU.connect(user).approve(await wstEDU.getAddress(), stEDUBalance);
      await wstEDU.connect(user).wrap(stEDUBalance);
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      
      // Deposit rewards to change index
      const rewardAmount = ethers.parseEther("10");
      await depositRewards(stEDU, owner, rewardAmount);
      
      // Get predicted EDU value
      const predictedEDUValue = await wstEDU.wstEDUToEDU(wstEDUBalance);
      console.log(`Predicted EDU value from wstEDUToEDU: ${ethers.formatEther(predictedEDUValue)}`);
      
      // Get user's initial balance
      const initialBalance = await ethers.provider.getBalance(user.address);
      
      // Unwrap wstEDU
      await wstEDU.connect(user).unwrap(wstEDUBalance);
      const unwrappedStEDUBalance = await stEDU.balanceOf(user.address);
      console.log(`Unwrapped stEDU balance: ${ethers.formatEther(unwrappedStEDUBalance)}`);
      
      // Unstake stEDU
      const unstakeTx = await stEDU.connect(user).unstake(unwrappedStEDUBalance);
      const receipt = await unstakeTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      // Get user's final balance
      const finalBalance = await ethers.provider.getBalance(user.address);
      
      // Calculate actual EDU received
      const actualEDUReceived = finalBalance + gasCost - initialBalance;
      console.log(`Actual EDU received: ${ethers.formatEther(actualEDUReceived)}`);
      console.log(`Difference: ${ethers.formatEther(actualEDUReceived - predictedEDUValue)}`);
      
      // Compare predicted and actual values
      expect(predictedEDUValue).to.be.closeTo(actualEDUReceived, ethers.parseEther("0.0001"));
    });

    it("Should correctly account for index changes", async function () {
      const user = users[0];
      const stakeAmount = ethers.parseEther("100");
      console.log(`\nStake amount: ${ethers.formatEther(stakeAmount)} EDU`);
      
      // Stake EDU
      await stakeEDU(stEDU, user, stakeAmount);
      const stEDUBalance = await stEDU.balanceOf(user.address);
      console.log(`stEDU balance after staking: ${ethers.formatEther(stEDUBalance)}`);
      
      // Approve and wrap stEDU
      await stEDU.connect(user).approve(await wstEDU.getAddress(), stEDUBalance);
      await wstEDU.connect(user).wrap(stEDUBalance);
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      console.log(`wstEDU balance after wrapping: ${ethers.formatEther(wstEDUBalance)}`);
      
      // Check initial EDU value
      const initialEDUValue = await wstEDU.wstEDUToEDU(wstEDUBalance);
      console.log(`Initial EDU value: ${ethers.formatEther(initialEDUValue)}`);
      expect(initialEDUValue).to.be.closeTo(stakeAmount, ethers.parseEther("0.0001"));
      
      // Deposit rewards to change index
      const rewardAmount = ethers.parseEther("10");
      console.log(`Depositing ${ethers.formatEther(rewardAmount)} EDU as rewards`);
      await depositRewards(stEDU, owner, rewardAmount);
      
      // Check new EDU value
      const newEDUValue = await wstEDU.wstEDUToEDU(wstEDUBalance);
      console.log(`New EDU value after rewards: ${ethers.formatEther(newEDUValue)}`);
      
      // The new value should be approximately the initial value plus the proportional rewards
      const expectedNewValue = stakeAmount + (rewardAmount * stakeAmount) / (stakeAmount);
      console.log(`Expected new value: ${ethers.formatEther(expectedNewValue)}`);
      console.log(`Difference: ${ethers.formatEther(newEDUValue - expectedNewValue)}`);
      expect(newEDUValue).to.be.closeTo(expectedNewValue, ethers.parseEther("0.0001"));
    });
  });

  describe("getStEDUAmount Function", function () {
    it("Should return 0 when no wstEDU tokens exist", async function () {
      const result = await wstEDU.getStEDUAmount(ONE_EDU);
      expect(result).to.equal(0);
    });

    it("Should match the actual stEDU received when unwrapping", async function () {
      const user = users[0];
      const stakeAmount = ethers.parseEther("100");
      console.log(`\nStake amount: ${ethers.formatEther(stakeAmount)} EDU`);
      
      // Stake EDU
      await stakeEDU(stEDU, user, stakeAmount);
      const stEDUBalance = await stEDU.balanceOf(user.address);
      console.log(`stEDU balance after staking: ${ethers.formatEther(stEDUBalance)}`);
      
      // Approve and wrap stEDU
      await stEDU.connect(user).approve(await wstEDU.getAddress(), stEDUBalance);
      await wstEDU.connect(user).wrap(stEDUBalance);
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      console.log(`wstEDU balance after wrapping: ${ethers.formatEther(wstEDUBalance)}`);
      
      // Deposit rewards to change index
      const rewardAmount = ethers.parseEther("10");
      console.log(`Depositing ${ethers.formatEther(rewardAmount)} EDU as rewards`);
      await depositRewards(stEDU, owner, rewardAmount);
      
      // Get predicted stEDU amount
      const predictedStEDUAmount = await wstEDU.getStEDUAmount(wstEDUBalance);
      console.log(`Predicted stEDU amount from getStEDUAmount: ${ethers.formatEther(predictedStEDUAmount)}`);
      
      // Unwrap wstEDU
      await wstEDU.connect(user).unwrap(wstEDUBalance);
      const actualStEDUAmount = await stEDU.balanceOf(user.address);
      console.log(`Actual stEDU amount after unwrapping: ${ethers.formatEther(actualStEDUAmount)}`);
      console.log(`Difference: ${ethers.formatEther(actualStEDUAmount - predictedStEDUAmount)}`);
      
      // Compare predicted and actual values
      expect(predictedStEDUAmount).to.equal(actualStEDUAmount);
    });
  });

  describe("stEDUToEDU Function", function () {
    it("Should match the actual EDU received when unstaking", async function () {
      const user = users[0];
      const stakeAmount = ethers.parseEther("100");
      console.log(`\nStake amount: ${ethers.formatEther(stakeAmount)} EDU`);
      
      // Stake EDU
      await stakeEDU(stEDU, user, stakeAmount);
      const stEDUBalance = await stEDU.balanceOf(user.address);
      console.log(`stEDU balance after staking: ${ethers.formatEther(stEDUBalance)}`);
      
      // Deposit rewards to change index
      const rewardAmount = ethers.parseEther("10");
      console.log(`Depositing ${ethers.formatEther(rewardAmount)} EDU as rewards`);
      await depositRewards(stEDU, owner, rewardAmount);
      
      // Get predicted EDU value
      const predictedEDUValue = await stEDU.stEDUToEDU(stEDUBalance);
      console.log(`Predicted EDU value from stEDUToEDU: ${ethers.formatEther(predictedEDUValue)}`);
      
      // Get user's initial balance
      const initialBalance = await ethers.provider.getBalance(user.address);
      
      // Unstake stEDU
      const unstakeTx = await stEDU.connect(user).unstake(stEDUBalance);
      const receipt = await unstakeTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      // Get user's final balance
      const finalBalance = await ethers.provider.getBalance(user.address);
      
      // Calculate actual EDU received
      const actualEDUReceived = finalBalance + gasCost - initialBalance;
      console.log(`Actual EDU received: ${ethers.formatEther(actualEDUReceived)}`);
      console.log(`Difference: ${ethers.formatEther(actualEDUReceived - predictedEDUValue)}`);
      
      // Compare predicted and actual values
      expect(predictedEDUValue).to.be.closeTo(actualEDUReceived, ethers.parseEther("0.0001"));
    });
  });

  describe("Full Cycle Test", function () {
    it("Should correctly predict values throughout the entire cycle", async function () {
      const user = users[0];
      const stakeAmount = ethers.parseEther("100");
      console.log(`\n--- FULL CYCLE TEST ---`);
      console.log(`Stake amount: ${ethers.formatEther(stakeAmount)} EDU`);
      
      // Stake EDU
      await stakeEDU(stEDU, user, stakeAmount);
      const stEDUBalance = await stEDU.balanceOf(user.address);
      console.log(`stEDU balance after staking: ${ethers.formatEther(stEDUBalance)}`);
      
      // Check stEDU to EDU conversion
      const stEDUToEDUValue = await stEDU.stEDUToEDU(stEDUBalance);
      console.log(`stEDUToEDU value: ${ethers.formatEther(stEDUToEDUValue)}`);
      expect(stEDUToEDUValue).to.be.closeTo(stakeAmount, ethers.parseEther("0.0001"));
      
      // Approve and wrap stEDU
      await stEDU.connect(user).approve(await wstEDU.getAddress(), stEDUBalance);
      await wstEDU.connect(user).wrap(stEDUBalance);
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      console.log(`wstEDU balance after wrapping: ${ethers.formatEther(wstEDUBalance)}`);
      
      // Check wstEDU to EDU conversion before rewards
      const wstEDUToEDUBefore = await wstEDU.wstEDUToEDU(wstEDUBalance);
      console.log(`wstEDUToEDU before rewards: ${ethers.formatEther(wstEDUToEDUBefore)}`);
      expect(wstEDUToEDUBefore).to.be.closeTo(stakeAmount, ethers.parseEther("0.0001"));
      
      // Deposit rewards to change index
      const rewardAmount = ethers.parseEther("10");
      console.log(`\nDepositing ${ethers.formatEther(rewardAmount)} EDU as rewards`);
      await depositRewards(stEDU, owner, rewardAmount);
      
      // Check wstEDU to EDU conversion after rewards
      const wstEDUToEDUAfter = await wstEDU.wstEDUToEDU(wstEDUBalance);
      console.log(`wstEDUToEDU after rewards: ${ethers.formatEther(wstEDUToEDUAfter)}`);
      const expectedEDUValue = stakeAmount + (rewardAmount * stakeAmount) / (stakeAmount);
      console.log(`Expected EDU value: ${ethers.formatEther(expectedEDUValue)}`);
      console.log(`Difference: ${ethers.formatEther(wstEDUToEDUAfter - expectedEDUValue)}`);
      expect(wstEDUToEDUAfter).to.be.closeTo(expectedEDUValue, ethers.parseEther("0.0001"));
      
      // Check getStEDUAmount
      const predictedStEDUAmount = await wstEDU.getStEDUAmount(wstEDUBalance);
      console.log(`\nPredicted stEDU amount from getStEDUAmount: ${ethers.formatEther(predictedStEDUAmount)}`);
      
      // Unwrap wstEDU
      await wstEDU.connect(user).unwrap(wstEDUBalance);
      const actualStEDUAmount = await stEDU.balanceOf(user.address);
      console.log(`Actual stEDU amount after unwrapping: ${ethers.formatEther(actualStEDUAmount)}`);
      console.log(`Difference: ${ethers.formatEther(actualStEDUAmount - predictedStEDUAmount)}`);
      
      // Compare predicted and actual stEDU amounts
      expect(predictedStEDUAmount).to.equal(actualStEDUAmount);
      
      // Check stEDU to EDU conversion after unwrapping
      const stEDUToEDUAfter = await stEDU.stEDUToEDU(actualStEDUAmount);
      console.log(`\nstEDUToEDU after unwrapping: ${ethers.formatEther(stEDUToEDUAfter)}`);
      console.log(`Difference from wstEDUToEDU: ${ethers.formatEther(stEDUToEDUAfter - wstEDUToEDUAfter)}`);
      expect(stEDUToEDUAfter).to.be.closeTo(wstEDUToEDUAfter, ethers.parseEther("0.0001"));
      
      // Get user's initial balance
      const initialBalance = await ethers.provider.getBalance(user.address);
      
      // Unstake stEDU
      const unstakeTx = await stEDU.connect(user).unstake(actualStEDUAmount);
      const receipt = await unstakeTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      // Get user's final balance
      const finalBalance = await ethers.provider.getBalance(user.address);
      
      // Calculate actual EDU received
      const actualEDUReceived = finalBalance + gasCost - initialBalance;
      console.log(`\nActual EDU received from unstaking: ${ethers.formatEther(actualEDUReceived)}`);
      console.log(`Difference from stEDUToEDU: ${ethers.formatEther(actualEDUReceived - stEDUToEDUAfter)}`);
      
      // Compare predicted and actual values
      expect(stEDUToEDUAfter).to.be.closeTo(actualEDUReceived, ethers.parseEther("0.0001"));
    });
  });
});
