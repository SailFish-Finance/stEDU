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
  calculateEDUAmount
} = require("./helpers");

describe("stEDU Staking Tests", function () {
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

  describe("Staking", function () {
    it("Should allow users to stake EDU and receive stEDU", async function () {
      const user = users[0];
      const stakeAmount = TEN_EDU;
      
      // Get initial balances
      const initialStEDUBalance = await stEDU.balanceOf(user.address);
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Check stEDU balance
      const finalStEDUBalance = await stEDU.balanceOf(user.address);
      const stEDUReceived = finalStEDUBalance - initialStEDUBalance;
      
      // Calculate expected stEDU amount
      const expectedStEDUAmount = calculateStEDUAmount(stakeAmount, INITIAL_INDEX);
      
      expect(stEDUReceived).to.equal(expectedStEDUAmount);
    });

    it("Should update total supply after staking", async function () {
      const stakeAmount = TEN_EDU;
      
      // Get initial total supply
      const initialTotalSupply = await stEDU.totalSupply();
      
      // Stake EDU
      await stEDU.connect(users[0]).stake({ value: stakeAmount });
      
      // Check total supply
      const finalTotalSupply = await stEDU.totalSupply();
      const expectedIncrease = calculateStEDUAmount(stakeAmount, INITIAL_INDEX);
      
      expect(finalTotalSupply - initialTotalSupply).to.equal(expectedIncrease);
    });

    it("Should update total assets after staking", async function () {
      const stakeAmount = TEN_EDU;
      
      // Get initial total assets
      const initialTotalAssets = await stEDU.totalAssets();
      
      // Stake EDU
      await stEDU.connect(users[0]).stake({ value: stakeAmount });
      
      // Check total assets
      const finalTotalAssets = await stEDU.totalAssets();
      
      expect(finalTotalAssets - initialTotalAssets).to.equal(stakeAmount);
    });

    it("Should emit Staked event with correct parameters", async function () {
      const user = users[0];
      const stakeAmount = TEN_EDU;
      const expectedShares = calculateStEDUAmount(stakeAmount, INITIAL_INDEX);
      
      await expect(stEDU.connect(user).stake({ value: stakeAmount }))
        .to.emit(stEDU, "Staked")
        .withArgs(user.address, stakeAmount, expectedShares);
    });

    it("Should revert when staking zero EDU", async function () {
      await expect(stEDU.connect(users[0]).stake({ value: 0 }))
        .to.be.revertedWith("Must send EDU");
    });

    it("Should revert when staking while paused", async function () {
      await stEDU.connect(owner).pause();
      
      await expect(stEDU.connect(users[0]).stake({ value: TEN_EDU }))
        .to.be.revertedWithCustomError(stEDU, "EnforcedPause");
    });

    it("Should track deposits with timestamps", async function () {
      const user = users[0];
      const stakeAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Get current block timestamp
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const timestamp = block.timestamp;
      
      // We can't directly access the _deposits mapping, but we can verify
      // the deposit tracking by attempting to unstake immediately (should fail)
      // and then after the delay (should succeed)
      
      // Try to unstake immediately (should fail)
      await expect(stEDU.connect(user).unstake(calculateStEDUAmount(stakeAmount, INITIAL_INDEX)))
        .to.be.revertedWith("Requested amount still locked");
    });

    it("Should allow multiple deposits from the same user", async function () {
      const user = users[0];
      const firstStakeAmount = TEN_EDU;
      const secondStakeAmount = HUNDRED_EDU;
      
      // First stake
      await stEDU.connect(user).stake({ value: firstStakeAmount });
      const balanceAfterFirstStake = await stEDU.balanceOf(user.address);
      
      // Second stake
      await stEDU.connect(user).stake({ value: secondStakeAmount });
      const balanceAfterSecondStake = await stEDU.balanceOf(user.address);
      
      // Calculate expected stEDU amounts
      const expectedFirstStEDU = calculateStEDUAmount(firstStakeAmount, INITIAL_INDEX);
      const expectedSecondStEDU = calculateStEDUAmount(secondStakeAmount, INITIAL_INDEX);
      
      // Check that balance increased by the expected amount
      expect(balanceAfterSecondStake - balanceAfterFirstStake).to.equal(expectedSecondStEDU);
      expect(balanceAfterSecondStake).to.equal(expectedFirstStEDU + expectedSecondStEDU);
    });
  });

  describe("Unstaking", function () {
    it("Should not allow unstaking before the delay period", async function () {
      const user = users[0];
      const stakeAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Try to unstake immediately
      await expect(stEDU.connect(user).unstake(stEDUBalance))
        .to.be.revertedWith("Requested amount still locked");
    });

    it("Should allow unstaking after the delay period", async function () {
      const user = users[0];
      const stakeAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Advance time past the unstake delay
      await advanceTimeAfterUnstakeDelay();
      
      // Get initial EDU balance
      const initialEDUBalance = await ethers.provider.getBalance(user.address);
      
      // Unstake
      const unstakeTx = await stEDU.connect(user).unstake(stEDUBalance);
      const receipt = await unstakeTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      // Get final EDU balance
      const finalEDUBalance = await ethers.provider.getBalance(user.address);
      
      // Calculate expected EDU amount
      const expectedEDUAmount = calculateEDUAmount(stEDUBalance, INITIAL_INDEX);
      
      // Check that user received the correct amount of EDU (accounting for gas costs)
      expect(finalEDUBalance + gasCost - initialEDUBalance).to.equal(expectedEDUAmount);
    });

    it("Should emit Unstaked event with correct parameters", async function () {
      const user = users[0];
      const stakeAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Advance time past the unstake delay
      await advanceTimeAfterUnstakeDelay();
      
      // Calculate expected EDU amount
      const expectedEDUAmount = calculateEDUAmount(stEDUBalance, INITIAL_INDEX);
      
      // Unstake and check event
      await expect(stEDU.connect(user).unstake(stEDUBalance))
        .to.emit(stEDU, "Unstaked")
        .withArgs(user.address, expectedEDUAmount, stEDUBalance);
    });

    it("Should update total supply after unstaking", async function () {
      const user = users[0];
      const stakeAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Advance time past the unstake delay
      await advanceTimeAfterUnstakeDelay();
      
      // Get total supply before unstaking
      const totalSupplyBefore = await stEDU.totalSupply();
      
      // Unstake
      await stEDU.connect(user).unstake(stEDUBalance);
      
      // Get total supply after unstaking
      const totalSupplyAfter = await stEDU.totalSupply();
      
      // Check that total supply decreased by the correct amount
      expect(totalSupplyBefore - totalSupplyAfter).to.equal(stEDUBalance);
    });

    it("Should update total assets after unstaking", async function () {
      const user = users[0];
      const stakeAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Advance time past the unstake delay
      await advanceTimeAfterUnstakeDelay();
      
      // Get total assets before unstaking
      const totalAssetsBefore = await stEDU.totalAssets();
      
      // Unstake
      await stEDU.connect(user).unstake(stEDUBalance);
      
      // Get total assets after unstaking
      const totalAssetsAfter = await stEDU.totalAssets();
      
      // Calculate expected EDU amount
      const expectedEDUAmount = calculateEDUAmount(stEDUBalance, INITIAL_INDEX);
      
      // Check that total assets decreased by the correct amount
      expect(totalAssetsBefore - totalAssetsAfter).to.equal(expectedEDUAmount);
    });

    it("Should revert when unstaking zero shares", async function () {
      await expect(stEDU.connect(users[0]).unstake(0))
        .to.be.revertedWith("Zero shares");
    });

    it("Should revert when unstaking more than balance", async function () {
      const user = users[0];
      const stakeAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Advance time past the unstake delay
      await advanceTimeAfterUnstakeDelay();
      
      // Try to unstake more than balance
      await expect(stEDU.connect(user).unstake(stEDUBalance + 1n))
        .to.be.revertedWith("Insufficient stEDU");
    });

    it("Should revert when unstaking while paused", async function () {
      const user = users[0];
      const stakeAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Advance time past the unstake delay
      await advanceTimeAfterUnstakeDelay();
      
      // Pause the contract
      await stEDU.connect(owner).pause();
      
      // Try to unstake
      await expect(stEDU.connect(user).unstake(stEDUBalance))
        .to.be.revertedWithCustomError(stEDU, "EnforcedPause");
    });
  });

  describe("Multiple Deposits and Partial Unstaking", function () {
    it("Should handle multiple deposits with different timestamps", async function () {
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
      
      // Advance time to unlock first deposit but not second
      await advanceTime(UNSTAKE_DELAY / 2 + 1);
      
      // Try to unstake all (should fail because second deposit is still locked)
      await expect(stEDU.connect(user).unstake(firstStEDUAmount + secondStEDUAmount))
        .to.be.revertedWith("Requested amount still locked");
      
      // Unstake only the first deposit amount (should succeed)
      await stEDU.connect(user).unstake(firstStEDUAmount);
      
      // Check balance after partial unstake
      const balanceAfterPartialUnstake = await stEDU.balanceOf(user.address);
      expect(balanceAfterPartialUnstake).to.equal(secondStEDUAmount);
      
      // Advance time to unlock second deposit
      await advanceTime(UNSTAKE_DELAY / 2 + 1);
      
      // Unstake remaining amount
      await stEDU.connect(user).unstake(secondStEDUAmount);
      
      // Check final balance
      const finalBalance = await stEDU.balanceOf(user.address);
      expect(finalBalance).to.equal(0);
    });

    it("Should handle partial unstaking from multiple deposits", async function () {
      const user = users[0];
      const firstStakeAmount = HUNDRED_EDU;
      const secondStakeAmount = HUNDRED_EDU;
      
      // First stake
      await stEDU.connect(user).stake({ value: firstStakeAmount });
      const firstStEDUAmount = calculateStEDUAmount(firstStakeAmount, INITIAL_INDEX);
      
      // Second stake
      await stEDU.connect(user).stake({ value: secondStakeAmount });
      const secondStEDUAmount = calculateStEDUAmount(secondStakeAmount, INITIAL_INDEX);
      
      // Advance time past the unstake delay
      await advanceTimeAfterUnstakeDelay();
      
      // Unstake half of total
      const halfTotalStEDU = (firstStEDUAmount + secondStEDUAmount) / 2n;
      await stEDU.connect(user).unstake(halfTotalStEDU);
      
      // Check remaining balance
      const remainingBalance = await stEDU.balanceOf(user.address);
      expect(remainingBalance).to.equal(firstStEDUAmount + secondStEDUAmount - halfTotalStEDU);
      
      // Unstake remaining amount
      await stEDU.connect(user).unstake(remainingBalance);
      
      // Check final balance
      const finalBalance = await stEDU.balanceOf(user.address);
      expect(finalBalance).to.equal(0);
    });

    it("Should handle FIFO unstaking order correctly", async function () {
      const user = users[0];
      const firstStakeAmount = TEN_EDU;
      const secondStakeAmount = HUNDRED_EDU;
      
      // First stake
      await stEDU.connect(user).stake({ value: firstStakeAmount });
      const firstStEDUAmount = calculateStEDUAmount(firstStakeAmount, INITIAL_INDEX);
      
      // Advance time partially
      await advanceTime(UNSTAKE_DELAY / 2);
      
      // Second stake
      await stEDU.connect(user).stake({ value: secondStakeAmount });
      
      // Advance time to unlock first deposit but not second
      await advanceTime(UNSTAKE_DELAY / 2 + 1);
      
      // Try to unstake more than first deposit (should fail)
      await expect(stEDU.connect(user).unstake(firstStEDUAmount + 1n))
        .to.be.revertedWith("Requested amount still locked");
      
      // Unstake exactly first deposit amount (should succeed)
      await stEDU.connect(user).unstake(firstStEDUAmount);
    });
  });
});
