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
} = require("./helpers");

describe("stEDU Attack Tests", function () {
  let mockWEDU;
  let stEDU;
  let owner;
  let users;
  let attacker;

  beforeEach(async function () {
    const contracts = await deployContracts();
    mockWEDU = contracts.mockWEDU;
    stEDU = contracts.stEDU;
    owner = contracts.owner;
    users = contracts.users;
    attacker = users[5]; // Designate a specific user as the attacker
  });

  describe("Front-running Attack Tests", function () {
    it("Should prevent reward front-running due to unbonding period", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const attackerStakeAmount = HUNDRED_EDU * 10n; // Large amount to maximize reward capture
      const rewardAmount = TEN_EDU;

      // User stakes EDU
      await stEDU.connect(user).stake({ value: stakeAmount });

      // Simulate front-running: Attacker sees reward transaction in mempool and quickly stakes
      await stEDU.connect(attacker).stake({ value: attackerStakeAmount });

      // Owner deposits rewards
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });

      // Calculate attacker's share of rewards
      const totalSupply = await stEDU.totalSupply();
      const attackerStEDUBalance = await stEDU.balanceOf(attacker.address);
      const attackerPortion =
        (attackerStEDUBalance * ethers.parseEther("1")) / totalSupply;
      const attackerExpectedReward =
        (rewardAmount * attackerPortion) / ethers.parseEther("1");

      // Attacker tries to immediately unstake to capture rewards
      await expect(
        stEDU.connect(attacker).unstake(attackerStEDUBalance)
      ).to.be.revertedWith("Requested amount still locked");

      // Even after waiting a short time, attacker still can't unstake
      await advanceTime(UNSTAKE_DELAY / 2);
      await expect(
        stEDU.connect(attacker).unstake(attackerStEDUBalance)
      ).to.be.revertedWith("Requested amount still locked");

      // Only after the full unbonding period can the attacker unstake
      await advanceTime(UNSTAKE_DELAY / 2 + 1);

      // Get attacker's initial EDU balance
      const initialEDUBalance = await ethers.provider.getBalance(
        attacker.address
      );

      // Attacker unstakes
      const unstakeTx = await stEDU
        .connect(attacker)
        .unstake(attackerStEDUBalance);
      const receipt = await unstakeTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      // Get attacker's final EDU balance
      const finalEDUBalance = await ethers.provider.getBalance(
        attacker.address
      );

      // Calculate actual EDU received
      const eduReceived = finalEDUBalance + gasCost - initialEDUBalance;

      // Verify attacker received their stake plus rewards
      const expectedEDUReceived = attackerStakeAmount + attackerExpectedReward;
      expect(eduReceived).to.be.closeTo(expectedEDUReceived, ethers.parseEther("0.000000001"));

      // The key point is that the attacker had to wait the full unbonding period,
      // which prevents flash loan attacks and quick front-running
    });

    it("Should prevent flash loan attack due to unbonding period", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const flashLoanAmount = HUNDRED_EDU * 100n; // Very large amount to simulate flash loan
      const rewardAmount = TEN_EDU;

      // User stakes EDU
      await stEDU.connect(user).stake({ value: stakeAmount });

      // Simulate flash loan attack: Attacker borrows large amount and stakes
      await stEDU.connect(attacker).stake({ value: flashLoanAmount });

      // Owner deposits rewards
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });

      // Attacker tries to immediately unstake to repay flash loan
      // This should fail due to unbonding period
      await expect(
        stEDU.connect(attacker).unstake(await stEDU.balanceOf(attacker.address))
      ).to.be.revertedWith("Requested amount still locked");

      // Flash loans must be repaid in the same transaction or block,
      // so this effectively prevents flash loan attacks
    });
  });

  describe("Reward Inflation Tests", function () {
    it("Should prevent index manipulation through small deposits", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const tinyStakeAmount = 1n; // Smallest possible amount

      // User stakes a normal amount
      await stEDU.connect(user).stake({ value: stakeAmount });

      // Attacker tries to stake a tiny amount to manipulate index calculations
      await stEDU.connect(attacker).stake({ value: tinyStakeAmount });

      // Get initial index
      const initialIndex = await stEDU.index();

      // Owner deposits rewards
      const rewardAmount = TEN_EDU;
      await stEDU.connect(owner).depositRewards({ value: rewardAmount });

      // Get new index
      const newIndex = await stEDU.index();

      // Calculate expected index increase
      const totalSupply = await stEDU.totalSupply();
      const expectedIndexIncrease = calculateIndexIncrease(
        rewardAmount,
        totalSupply
      );

      // Verify index increased by expected amount
      expect(newIndex - initialIndex).to.equal(expectedIndexIncrease);

      // The key point is that even with extreme values, the math remains correct
      // and the index calculation is not manipulated
    });

    it("Should handle extreme values without overflow", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const largerStakeAmount = HUNDRED_EDU * 10n; // Larger but not extreme
      const tinyRewardAmount = 1n; // Smallest possible reward

      // User stakes a normal amount
      await stEDU.connect(user).stake({ value: stakeAmount });

      // Attacker stakes a larger amount
      await stEDU.connect(attacker).stake({ value: largerStakeAmount });

      // Owner deposits a tiny reward
      await stEDU.connect(owner).depositRewards({ value: tinyRewardAmount });

      // The transaction should complete without reverting due to overflow

      // Now test the opposite: tiny stake, moderate reward
      const tinyStakeAmount = 1n;
      const moderateRewardAmount = ONE_EDU;

      // New user stakes tiny amount
      await stEDU.connect(users[1]).stake({ value: tinyStakeAmount });

      // Owner deposits moderate reward
      await stEDU.connect(owner).depositRewards({ value: moderateRewardAmount });

      // The transaction should complete without reverting due to overflow
    });

    it("Should prevent donation manipulation through sync", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const donationAmount = TEN_EDU;

      // User stakes EDU
      await stEDU.connect(user).stake({ value: stakeAmount });

      // Get initial index
      const initialIndex = await stEDU.index();

      // Attacker tries to manipulate by sending WEDU directly and calling sync
      await mockWEDU.connect(attacker).deposit({ value: donationAmount });
      await mockWEDU
        .connect(attacker)
        .transfer(await stEDU.getAddress(), donationAmount);

      // Attacker calls sync
      await stEDU.connect(attacker).sync();

      // Get new index
      const newIndex = await stEDU.index();

      // Calculate expected index increase
      const totalSupply = await stEDU.totalSupply();
      const expectedIndexIncrease = calculateIndexIncrease(
        donationAmount,
        totalSupply
      );

      // Verify index increased by expected amount
      expect(newIndex - initialIndex).to.equal(expectedIndexIncrease);

      // The key point is that even though the attacker can trigger a sync,
      // they can't manipulate the index calculation, and all users benefit
      // proportionally from the donation
    });
  });

  describe("Reentrancy Attack Tests", function () {
    it("Should prevent reentrancy attacks on unstake", async function () {
      // Deploy a malicious contract that attempts reentrancy
      const MaliciousReceiver = await ethers.getContractFactory(
        "MaliciousReceiver"
      );
      const maliciousReceiver = await MaliciousReceiver.deploy(
        await stEDU.getAddress()
      );

      // Stake EDU from the attacker
      const stakeAmount = HUNDRED_EDU;
      await stEDU.connect(attacker).stake({ value: stakeAmount });

      // Transfer stEDU to the malicious contract
      const stEDUBalance = await stEDU.balanceOf(attacker.address);
      await stEDU
        .connect(attacker)
        .transfer(await maliciousReceiver.getAddress(), stEDUBalance);

      // Advance time past the unstake delay
      await advanceTimeAfterUnstakeDelay();

      // Attempt reentrancy attack
      // The malicious contract will try to call unstake again during the first unstake
      await expect(
        maliciousReceiver.connect(attacker).attackUnstake(stEDUBalance)
      ).to.be.revertedWith("ReentrancyGuard: reentrant call");
    });
  });

  describe("Direct WEDU Transfer Tests", function () {
    it("Should correctly handle direct WEDU transfers through sync", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      const directWEDUAmount = TEN_EDU;
      
      // User stakes EDU
      await stEDU.connect(user).stake({ value: stakeAmount });
      
      // Get initial index
      const initialIndex = await stEDU.index();
      
      // Attacker sends WEDU directly to the contract
      await mockWEDU.connect(attacker).deposit({ value: directWEDUAmount });
      await mockWEDU.connect(attacker).transfer(await stEDU.getAddress(), directWEDUAmount);
      
      // Verify WEDU balance increased but index hasn't changed yet
      const weduBalance = await mockWEDU.balanceOf(await stEDU.getAddress());
      const expectedBalance = stakeAmount + directWEDUAmount;
      expect(weduBalance).to.equal(expectedBalance);
      expect(await stEDU.index()).to.equal(initialIndex);
      
      // Call sync to incorporate the surplus WEDU
      await stEDU.connect(attacker).sync();
      
      // Verify index increased correctly
      const newIndex = await stEDU.index();
      const totalSupply = await stEDU.totalSupply();
      const expectedIndexIncrease = calculateIndexIncrease(directWEDUAmount, totalSupply);
      expect(newIndex - initialIndex).to.equal(expectedIndexIncrease);
      
      // Verify the user's stEDU value increased
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const eduValue = await stEDU.stEDUToEDU(stEDUBalance);
      expect(eduValue).to.be.gt(stakeAmount);
      expect(eduValue).to.equal(stakeAmount + directWEDUAmount);
    });
  });
  
  describe("Security Mechanism Tests", function () {
    it("Should prevent operations when paused", async function () {
      const user = users[0];
      const stakeAmount = HUNDRED_EDU;
      
      // Pause the contract
      await stEDU.connect(owner).pause();
      
      // Verify staking is prevented
      await expect(stEDU.connect(user).stake({ value: stakeAmount }))
        .to.be.revertedWithCustomError(stEDU, "EnforcedPause");
      
      // Stake some EDU (after unpausing)
      await stEDU.connect(owner).unpause();
      await stEDU.connect(user).stake({ value: stakeAmount });
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Pause again and verify unstaking is prevented
      await stEDU.connect(owner).pause();
      await advanceTimeAfterUnstakeDelay();
      await expect(stEDU.connect(user).unstake(stEDUBalance))
        .to.be.revertedWithCustomError(stEDU, "EnforcedPause");
      
      // Verify rewards are prevented while paused
      await expect(stEDU.connect(owner).depositRewards({ value: TEN_EDU }))
        .to.be.revertedWithCustomError(stEDU, "EnforcedPause");
      
      // Verify sync is prevented while paused
      await mockWEDU.connect(attacker).deposit({ value: TEN_EDU });
      await mockWEDU.connect(attacker).transfer(await stEDU.getAddress(), TEN_EDU);
      await expect(stEDU.connect(attacker).sync())
        .to.be.revertedWithCustomError(stEDU, "EnforcedPause");
    });
    
    it("Should prevent non-owners from calling privileged functions", async function () {
      // Verify non-owner cannot pause
      await expect(stEDU.connect(attacker).pause())
        .to.be.revertedWithCustomError(stEDU, "OwnableUnauthorizedAccount");
      
      // Verify non-owner cannot unpause
      await stEDU.connect(owner).pause();
      await expect(stEDU.connect(attacker).unpause())
        .to.be.revertedWithCustomError(stEDU, "OwnableUnauthorizedAccount");
      await stEDU.connect(owner).unpause();
      
      // Verify non-owner cannot deposit rewards
      await stEDU.connect(users[0]).stake({ value: HUNDRED_EDU });
      await expect(stEDU.connect(attacker).depositRewards({ value: TEN_EDU }))
        .to.be.revertedWithCustomError(stEDU, "OwnableUnauthorizedAccount");
    });
  });
});
