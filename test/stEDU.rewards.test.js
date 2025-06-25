const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  INITIAL_INDEX,
  ONE_EDU,
  TEN_EDU,
  HUNDRED_EDU,
  deployContracts,
  advanceTimeAfterUnstakeDelay,
  calculateStEDUAmount,
  calculateEDUAmount,
  calculateIndexIncrease
} = require("./helpers");

describe("stEDU Rewards Tests", function () {
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

  describe("Rewards Distribution", function () {
    it("Should allow owner to deposit rewards", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const rewardAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Get initial index
      const initialIndex = await stEDU.index();
      
      // Deposit rewards
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });
      
      // Get new index
      const newIndex = await stEDU.index();
      
      // Check that index increased
      expect(newIndex).to.be.gt(initialIndex);
    });

    it("Should calculate index increase correctly", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const rewardAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Get initial index
      const initialIndex = await stEDU.index();
      
      // Get total supply
      const totalSupply = await stEDU.totalSupply();
      
      // Deposit rewards
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });
      
      // Get new index
      const newIndex = await stEDU.index();
      
      // Calculate expected index increase
      const expectedIndexIncrease = calculateIndexIncrease(rewardAmount, totalSupply);
      
      // Check that index increased by the expected amount
      expect(newIndex - initialIndex).to.equal(expectedIndexIncrease);
    });

    it("Should emit RewardsDeposited event with correct parameters", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const rewardAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Get total supply
      const totalSupply = await stEDU.totalSupply();
      
      // Calculate expected new index
      const expectedIndexIncrease = calculateIndexIncrease(rewardAmount, totalSupply);
      const expectedNewIndex = INITIAL_INDEX + expectedIndexIncrease;
      
      // Deposit rewards and check event
      await expect(stEDU.connect(owner).depositRewards({ value: rewardAmount }))
        .to.emit(stEDU, "RewardsDeposited")
        .withArgs(owner.address, rewardAmount, expectedNewIndex);
    });

    it("Should revert when non-owner tries to deposit rewards", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const rewardAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Try to deposit rewards as non-owner
      await expect(stEDU.connect(user).depositRewards({ value: rewardAmount }))
        .to.be.revertedWithCustomError(stEDU, "OwnableUnauthorizedAccount");
    });

    it("Should revert when depositing zero rewards", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Try to deposit zero rewards
      await expect(stEDU.connect(owner).depositRewards({ value: 0 }))
        .to.be.revertedWith("No reward sent");
    });

    it("Should revert when depositing rewards with no stakers", async function () {
      // Try to deposit rewards with no stakers
      await expect(stEDU.connect(owner).depositRewards({ value: TEN_EDU }))
        .to.be.revertedWith("Nothing staked");
    });

    it("Should revert when depositing rewards while paused", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Pause the contract
      await stEDU.connect(owner).pause();
      
      // Try to deposit rewards while paused
      await expect(stEDU.connect(owner).depositRewards({ value: TEN_EDU }))
        .to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Rewards Accrual", function () {
    it("Should increase stEDU value after rewards", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const rewardAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Get initial EDU value
      const initialEDUValue = await stEDU.stEDUToEDU(stEDUBalance);
      
      // Deposit rewards
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });
      
      // Get new EDU value
      const newEDUValue = await stEDU.stEDUToEDU(stEDUBalance);
      
      // Check that EDU value increased
      expect(newEDUValue).to.be.gt(initialEDUValue);
      
      // Check that EDU value increased by the reward amount
      expect(newEDUValue - initialEDUValue).to.equal(rewardAmount);
    });

    it("Should maintain stEDU balance after rewards", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const rewardAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const initialStEDUBalance = await stEDU.balanceOf(user.address);
      
      // Deposit rewards
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });
      
      // Get new stEDU balance
      const newStEDUBalance = await stEDU.balanceOf(user.address);
      
      // Check that stEDU balance remains the same
      expect(newStEDUBalance).to.equal(initialStEDUBalance);
    });

    it("Should distribute rewards proportionally to stake", async function () {
      const user1 = users[0];
      const user2 = users[1];
      const stakeAmount1 = HUNDRED_EDU;
      const stakeAmount2 = HUNDRED_EDU * 2n;
      const rewardAmount = TEN_EDU;
      
      // User 1 stakes
      await stEDU.connect(user1).stake({ value: stakeAmount1 });
      const stEDUBalance1 = await stEDU.balanceOf(user1.address);
      
      // User 2 stakes
      await stEDU.connect(user2).stake({ value: stakeAmount2 });
      const stEDUBalance2 = await stEDU.balanceOf(user2.address);
      
      // Get initial EDU values
      const initialEDUValue1 = await stEDU.stEDUToEDU(stEDUBalance1);
      const initialEDUValue2 = await stEDU.stEDUToEDU(stEDUBalance2);
      
      // Deposit rewards
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });
      
      // Get new EDU values
      const newEDUValue1 = await stEDU.stEDUToEDU(stEDUBalance1);
      const newEDUValue2 = await stEDU.stEDUToEDU(stEDUBalance2);
      
      // Calculate reward amounts
      const reward1 = newEDUValue1 - initialEDUValue1;
      const reward2 = newEDUValue2 - initialEDUValue2;
      
      // Check that rewards are proportional to stake
      // User 2 has 2x the stake, so should get 2x the rewards
      expect(reward2).to.equal(reward1 * 2n);
      
      // Check that total rewards match the deposited amount
      expect(reward1 + reward2).to.equal(rewardAmount);
    });

    it("Should allow unstaking with rewards after delay", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const rewardAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Deposit rewards
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });
      
      // Get expected EDU value
      const expectedEDUValue = await stEDU.stEDUToEDU(stEDUBalance);
      
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
      
      // Check that user received the correct amount of EDU (accounting for gas costs)
      expect(finalEDUBalance + gasCost - initialEDUBalance).to.equal(expectedEDUValue);
      
      // Check that user received their original stake plus rewards
      expect(finalEDUBalance + gasCost - initialEDUBalance).to.equal(stakeAmount + rewardAmount);
    });
  });

  describe("Sync Function", function () {
    it("Should allow anyone to sync surplus WEDU", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const surplusAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Get initial index
      const initialIndex = await stEDU.index();
      
      // Send WEDU directly to the contract to create a surplus
      await mockWEDU.connect(owner).deposit({ value: surplusAmount });
      await mockWEDU.connect(owner).transfer(await stEDU.getAddress(), surplusAmount);
      
      // Call sync
      await stEDU.connect(users[1]).sync();
      
      // Get new index
      const newIndex = await stEDU.index();
      
      // Check that index increased
      expect(newIndex).to.be.gt(initialIndex);
      
      // Calculate expected index increase
      const totalSupply = await stEDU.totalSupply();
      const expectedIndexIncrease = calculateIndexIncrease(surplusAmount, totalSupply);
      
      // Check that index increased by the expected amount
      expect(newIndex - initialIndex).to.equal(expectedIndexIncrease);
    });

    it("Should emit SurplusSynced event with correct parameters", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const surplusAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Get initial index
      const initialIndex = await stEDU.index();
      
      // Send WEDU directly to the contract to create a surplus
      await mockWEDU.connect(owner).deposit({ value: surplusAmount });
      await mockWEDU.connect(owner).transfer(await stEDU.getAddress(), surplusAmount);
      
      // Calculate expected new index
      const totalSupply = await stEDU.totalSupply();
      const expectedIndexIncrease = calculateIndexIncrease(surplusAmount, totalSupply);
      const expectedNewIndex = initialIndex + expectedIndexIncrease;
      
      // Call sync and check event
      await expect(stEDU.connect(users[1]).sync())
        .to.emit(stEDU, "SurplusSynced")
        .withArgs(surplusAmount, expectedNewIndex);
    });

    it("Should revert when there is no surplus", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Try to sync with no surplus
      await expect(stEDU.connect(users[1]).sync())
        .to.be.revertedWith("No surplus");
    });

    it("Should revert when syncing with no stakers", async function () {
      const surplusAmount = TEN_EDU;
      
      // Send WEDU directly to the contract to create a surplus
      await mockWEDU.connect(owner).deposit({ value: surplusAmount });
      await mockWEDU.connect(owner).transfer(await stEDU.getAddress(), surplusAmount);
      
      // Try to sync with no stakers
      await expect(stEDU.connect(users[1]).sync())
        .to.be.revertedWith("No shares");
    });

    it("Should revert when syncing while paused", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const surplusAmount = TEN_EDU;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Send WEDU directly to the contract to create a surplus
      await mockWEDU.connect(owner).deposit({ value: surplusAmount });
      await mockWEDU.connect(owner).transfer(await stEDU.getAddress(), surplusAmount);
      
      // Pause the contract
      await stEDU.connect(owner).pause();
      
      // Try to sync while paused
      await expect(stEDU.connect(users[1]).sync())
        .to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Multiple Rewards Distributions", function () {
    it("Should handle multiple reward distributions correctly", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const firstRewardAmount = TEN_EDU;
      const secondRewardAmount = TEN_EDU * 2n;
      
      // Stake EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Get initial EDU value
      const initialEDUValue = await stEDU.stEDUToEDU(stEDUBalance);
      
      // First reward distribution
      await stEDU.connect(owner).depositRewards({ value: firstRewardAmount });
      
      // Get EDU value after first reward
      const eduValueAfterFirstReward = await stEDU.stEDUToEDU(stEDUBalance);
      
      // Second reward distribution
      await stEDU.connect(owner).depositRewards({ value: secondRewardAmount });
      
      // Get EDU value after second reward
      const eduValueAfterSecondReward = await stEDU.stEDUToEDU(stEDUBalance);
      
      // Check that EDU value increased correctly after first reward
      expect(eduValueAfterFirstReward - initialEDUValue).to.equal(firstRewardAmount);
      
      // Check that EDU value increased correctly after second reward
      expect(eduValueAfterSecondReward - eduValueAfterFirstReward).to.equal(secondRewardAmount);
      
      // Check that total EDU value increase matches total rewards
      expect(eduValueAfterSecondReward - initialEDUValue).to.equal(firstRewardAmount + secondRewardAmount);
    });

    it("Should handle rewards with multiple stakers joining at different times", async function () {
      const user1 = users[0];
      const user2 = users[1];
      const stakeAmount1 = HUNDRED_EDU;
      const stakeAmount2 = HUNDRED_EDU * 2n;
      const firstRewardAmount = TEN_EDU;
      const secondRewardAmount = TEN_EDU * 2n;
      
      // User 1 stakes
      await stEDU.connect(user1).stake({ value: stakeAmount1 });
      const stEDUBalance1 = await stEDU.balanceOf(user1.address);
      
      // First reward distribution (only user 1 gets this)
      await stEDU.connect(owner).depositRewards({ value: firstRewardAmount });
      
      // User 2 stakes
      await stEDU.connect(user2).stake({ value: stakeAmount2 });
      const stEDUBalance2 = await stEDU.balanceOf(user2.address);
      
      // Get EDU values before second reward
      const eduValue1BeforeSecondReward = await stEDU.stEDUToEDU(stEDUBalance1);
      const eduValue2BeforeSecondReward = await stEDU.stEDUToEDU(stEDUBalance2);
      
      // Second reward distribution (both users get this)
      await stEDU.connect(owner).depositRewards({ value: secondRewardAmount });
      
      // Get EDU values after second reward
      const eduValue1AfterSecondReward = await stEDU.stEDUToEDU(stEDUBalance1);
      const eduValue2AfterSecondReward = await stEDU.stEDUToEDU(stEDUBalance2);
      
      // Calculate reward amounts from second distribution
      const reward1FromSecond = eduValue1AfterSecondReward - eduValue1BeforeSecondReward;
      const reward2FromSecond = eduValue2AfterSecondReward - eduValue2BeforeSecondReward;
      
      // Check that rewards from second distribution are proportional to stake
      // User 2 has 2x the stake, so should get 2x the rewards
      // But we need to account for the fact that user 1's stake has already increased from the first reward
      const totalStEDUSupply = await stEDU.totalSupply();
      const user1Portion = stEDUBalance1 * ethers.parseEther("1") / totalStEDUSupply;
      const user2Portion = stEDUBalance2 * ethers.parseEther("1") / totalStEDUSupply;
      
      // Check that rewards are proportional to stake portions
      expect(reward1FromSecond * user2Portion).to.be.closeTo(reward2FromSecond * user1Portion, 10n);
      
      // Check that total rewards from second distribution match the deposited amount
      expect(reward1FromSecond + reward2FromSecond).to.equal(secondRewardAmount);
      
      // Check that user 1 got all of the first reward
      expect(eduValue1BeforeSecondReward - stakeAmount1).to.equal(firstRewardAmount);
      
      // Check that user 2 got none of the first reward
      expect(eduValue2BeforeSecondReward).to.equal(stakeAmount2);
    });
  });
});
