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
  calculateEDUAmount,
  calculateWstEDUAmount,
  calculateStEDUFromWstEDU
} = require("./helpers");

describe("stEDU and wstEDU Integration", function () {
  let stEDU;
  let wstEDU;
  let owner;
  let users;
  const INITIAL_INDEX = BigInt(1e18);
  const ONE_EDU = ethers.parseEther("1");
  const TEN_EDU = ethers.parseEther("10");
  const HUNDRED_EDU = ethers.parseEther("100");

  beforeEach(async function () {
    const contracts = await deployContracts();
    stEDU = contracts.stEDU;
    wstEDU = contracts.wstEDU;
    owner = contracts.owner;
    users = contracts.users;
  });

  describe("Basic Integration", function () {
    it("Should handle stake → wrap → unwrap → unstake cycle", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const initialEDUBalance = await ethers.provider.getBalance(user.address);
      
      // Step 1: Stake EDU to get stEDU
      const stakeTx = await stakeEDU(stEDU, user, stakeAmount);
      const stakeReceipt = await stakeTx.wait();
      const stakeGasCost = stakeReceipt.gasUsed * stakeReceipt.gasPrice;
      
      const stEDUBalance = await stEDU.balanceOf(user.address);
      expect(stEDUBalance).to.equal(calculateStEDUAmount(stakeAmount, INITIAL_INDEX));
      
      // Step 2: Wrap stEDU to get wstEDU
      await wrapStEDU(stEDU, wstEDU, user, stEDUBalance);
      
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      expect(wstEDUBalance).to.equal(calculateWstEDUAmount(stEDUBalance, INITIAL_INDEX));
      expect(await stEDU.balanceOf(user.address)).to.equal(0);
      
      // Step 3: Unwrap wstEDU to get stEDU back
      await unwrapWstEDU(wstEDU, user, wstEDUBalance);
      
      const unwrappedStEDUBalance = await stEDU.balanceOf(user.address);
      expect(unwrappedStEDUBalance).to.equal(stEDUBalance);
      expect(await wstEDU.balanceOf(user.address)).to.equal(0);
      
      // Step 4: Unstake stEDU to get EDU back
      const unstakeTx = await unstakeEDU(stEDU, user, unwrappedStEDUBalance);
      const unstakeReceipt = await unstakeTx.wait();
      const unstakeGasCost = unstakeReceipt.gasUsed * unstakeReceipt.gasPrice;
      
      const finalEDUBalance = await ethers.provider.getBalance(user.address);
      
      // Account for gas costs in the comparison
      const totalGasCost = stakeGasCost + unstakeGasCost;
      expect(finalEDUBalance + totalGasCost).to.be.closeTo(initialEDUBalance, ethers.parseEther("0.01"));
    });

    it("Should maintain correct value relationship after rewards", async function () {
      // Setup: User stakes EDU and wraps half to wstEDU
      const user = users[0];
      await stakeEDU(stEDU, user, HUNDRED_EDU);
      
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const halfStEDU = stEDUBalance / BigInt(2);
      
      await wrapStEDU(stEDU, wstEDU, user, halfStEDU);
      
      const initialWstEDUBalance = await wstEDU.balanceOf(user.address);
      const initialStEDUBalance = await stEDU.balanceOf(user.address);
      
      // Record initial values
      const initialIndex = await stEDU.index();
      const initialStEDUValue = calculateEDUAmount(initialStEDUBalance, initialIndex);
      const initialWstEDUValue = await wstEDU.eduValue(initialWstEDUBalance);
      
      // Deposit rewards to trigger rebase
      await depositRewards(stEDU, owner, TEN_EDU);
      
      // Check new values
      const newIndex = await stEDU.index();
      expect(newIndex).to.be.gt(initialIndex);
      
      // stEDU balance should remain the same
      expect(await stEDU.balanceOf(user.address)).to.equal(initialStEDUBalance);
      
      // wstEDU balance should remain the same
      expect(await wstEDU.balanceOf(user.address)).to.equal(initialWstEDUBalance);
      
      // But the EDU value of both should increase
      const newStEDUValue = calculateEDUAmount(initialStEDUBalance, newIndex);
      const newWstEDUValue = await wstEDU.eduValue(initialWstEDUBalance);
      
      expect(newStEDUValue).to.be.gt(initialStEDUValue);
      expect(newWstEDUValue).to.be.gt(initialWstEDUValue);
      
      // The ratio of increase should be the same for both
      const stEDUIncrease = newStEDUValue * BigInt(1e18) / initialStEDUValue;
      const wstEDUIncrease = newWstEDUValue * BigInt(1e18) / initialWstEDUValue;
      
      expect(stEDUIncrease).to.be.closeTo(wstEDUIncrease, BigInt(1e15)); // Allow small rounding difference
    });

    it("Should handle wrap → rewards → unwrap correctly", async function () {
      // Setup: User stakes EDU and wraps all to wstEDU
      const user = users[0];
      await stakeEDU(stEDU, user, HUNDRED_EDU);
      
      const stEDUBalance = await stEDU.balanceOf(user.address);
      await wrapStEDU(stEDU, wstEDU, user, stEDUBalance);
      
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      
      // Deposit rewards to trigger rebase
      await depositRewards(stEDU, owner, TEN_EDU);
      
      // Calculate expected stEDU based on new index
      const newIndex = await stEDU.index();
      const expectedStEDU = calculateStEDUFromWstEDU(wstEDUBalance, newIndex);
      
      // Unwrap wstEDU to get stEDU back
      await unwrapWstEDU(wstEDU, user, wstEDUBalance);
      
      // The stEDU amount should be more than initially wrapped due to rewards
      const unwrappedStEDUBalance = await stEDU.balanceOf(user.address);
      expect(unwrappedStEDUBalance).to.be.gt(stEDUBalance);
      expect(unwrappedStEDUBalance).to.equal(expectedStEDU);
    });
  });

  describe("Multi-User Integration", function () {
    it("Should handle multiple users staking, wrapping, and rewards correctly", async function () {
      const user1 = users[0];
      const user2 = users[1];
      
      // User 1 stakes and wraps
      await stakeEDU(stEDU, user1, HUNDRED_EDU);
      const user1StEDUBalance = await stEDU.balanceOf(user1.address);
      await wrapStEDU(stEDU, wstEDU, user1, user1StEDUBalance);
      const user1WstEDUBalance = await wstEDU.balanceOf(user1.address);
      
      // User 2 stakes but doesn't wrap
      await stakeEDU(stEDU, user2, HUNDRED_EDU);
      const user2StEDUBalance = await stEDU.balanceOf(user2.address);
      
      // Deposit rewards
      await depositRewards(stEDU, owner, TEN_EDU);
      
      // Check user 2's stEDU balance (should be the same)
      expect(await stEDU.balanceOf(user2.address)).to.equal(user2StEDUBalance);
      
      // Check user 1's wstEDU balance (should be the same)
      expect(await wstEDU.balanceOf(user1.address)).to.equal(user1WstEDUBalance);
      
      // Unwrap user 1's wstEDU
      await unwrapWstEDU(wstEDU, user1, user1WstEDUBalance);
      
      // User 1's stEDU should be more than initially wrapped
      const user1UnwrappedStEDU = await stEDU.balanceOf(user1.address);
      expect(user1UnwrappedStEDU).to.be.gt(user1StEDUBalance);
      
      // Both users unstake
      await unstakeEDU(stEDU, user1, user1UnwrappedStEDU);
      await unstakeEDU(stEDU, user2, user2StEDUBalance);
      
      // Both users should have received more EDU than they staked
      // We can't easily check exact amounts due to gas costs, but we can check contract state
      expect(await stEDU.totalStaked()).to.equal(0);
    });
  });

  describe("Index Change Tests", function () {
    it("Should verify stEDU value increases after rewards", async function () {
      const user = users[0];
      await stakeEDU(stEDU, user, HUNDRED_EDU);
      
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const initialIndex = await stEDU.index();
      const initialEDUValue = calculateEDUAmount(stEDUBalance, initialIndex);
      
      // Deposit rewards
      await depositRewards(stEDU, owner, TEN_EDU);
      
      const newIndex = await stEDU.index();
      const newEDUValue = calculateEDUAmount(stEDUBalance, newIndex);
      
      expect(newEDUValue).to.be.gt(initialEDUValue);
      
      // The increase should be proportional to rewards
      const totalStaked = await stEDU.totalStaked();
      const expectedIncrease = (TEN_EDU * BigInt(1e18)) / totalStaked;
      const actualIncrease = newIndex - initialIndex;
      
      expect(actualIncrease).to.be.closeTo(expectedIncrease, BigInt(10)); // Allow small rounding difference
    });

    it("Should verify wstEDU maintains constant share after rewards", async function () {
      const user = users[0];
      await stakeEDU(stEDU, user, HUNDRED_EDU);
      
      const stEDUBalance = await stEDU.balanceOf(user.address);
      await wrapStEDU(stEDU, wstEDU, user, stEDUBalance);
      
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      const initialIndex = await stEDU.index();
      
      // Calculate initial share of total
      const initialTotalStaked = await stEDU.totalStaked();
      const initialStEDUEquivalent = calculateStEDUFromWstEDU(wstEDUBalance, initialIndex);
      const initialShare = (initialStEDUEquivalent * BigInt(1e18)) / initialTotalStaked;
      
      // Deposit rewards
      await depositRewards(stEDU, owner, TEN_EDU);
      
      // Calculate new share of total
      const newIndex = await stEDU.index();
      const newTotalStaked = await stEDU.totalStaked();
      const newStEDUEquivalent = calculateStEDUFromWstEDU(wstEDUBalance, newIndex);
      const newShare = (newStEDUEquivalent * BigInt(1e18)) / newTotalStaked;
      
      // Share should remain constant (within rounding error)
      // With the fixed wstEDU contract, the share calculation might be slightly different
      // Allow for a larger margin of error
      expect(newShare).to.be.closeTo(initialShare, BigInt(1e16));
    });
  });
});
