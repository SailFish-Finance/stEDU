const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  deployContracts,
  stakeEDU,
  unstakeEDU,
  depositRewards,
  calculateStEDUAmount,
  calculateEDUAmount
} = require("./helpers");

describe("stEDU Contract", function () {
  let stEDU;
  let owner;
  let users;
  const INITIAL_INDEX = BigInt(1e18);
  const ONE_EDU = ethers.parseEther("1");
  const TEN_EDU = ethers.parseEther("10");
  const HUNDRED_EDU = ethers.parseEther("100");

  beforeEach(async function () {
    const contracts = await deployContracts();
    stEDU = contracts.stEDU;
    owner = contracts.owner;
    users = contracts.users;
  });

  describe("Deployment", function () {
    it("Should initialize with correct name and symbol", async function () {
      expect(await stEDU.name()).to.equal("Staked EDU");
      expect(await stEDU.symbol()).to.equal("stEDU");
    });

    it("Should set initial index to 1e18", async function () {
      expect(await stEDU.index()).to.equal(INITIAL_INDEX);
    });

    it("Should set the owner correctly", async function () {
      expect(await stEDU.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero totalStaked", async function () {
      expect(await stEDU.totalStaked()).to.equal(0);
    });

    it("Should initialize with zero lastRecordedBalance", async function () {
      expect(await stEDU.lastRecordedBalance()).to.equal(0);
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake EDU and receive stEDU", async function () {
      const user = users[0];
      const initialBalance = await stEDU.balanceOf(user.address);
      
      await stakeEDU(stEDU, user, TEN_EDU);
      
      const finalBalance = await stEDU.balanceOf(user.address);
      const expectedStEDU = calculateStEDUAmount(TEN_EDU, INITIAL_INDEX);
      
      expect(finalBalance - initialBalance).to.equal(expectedStEDU);
    });

    it("Should update totalStaked and lastRecordedBalance correctly", async function () {
      const user = users[0];
      
      await stakeEDU(stEDU, user, TEN_EDU);
      
      const expectedStEDU = calculateStEDUAmount(TEN_EDU, INITIAL_INDEX);
      expect(await stEDU.totalStaked()).to.equal(expectedStEDU);
      expect(await stEDU.lastRecordedBalance()).to.equal(TEN_EDU);
    });

    it("Should emit Staked event with correct parameters", async function () {
      const user = users[0];
      const expectedStEDU = calculateStEDUAmount(TEN_EDU, INITIAL_INDEX);
      
      await expect(stakeEDU(stEDU, user, TEN_EDU))
        .to.emit(stEDU, "Staked")
        .withArgs(user.address, TEN_EDU, expectedStEDU);
    });

    it("Should revert when staking zero EDU", async function () {
      const user = users[0];
      
      await expect(stakeEDU(stEDU, user, 0))
        .to.be.revertedWith("Must send EDU");
    });

    it("Should allow multiple users to stake", async function () {
      await stakeEDU(stEDU, users[0], TEN_EDU);
      await stakeEDU(stEDU, users[1], HUNDRED_EDU);
      
      const expectedStEDU1 = calculateStEDUAmount(TEN_EDU, INITIAL_INDEX);
      const expectedStEDU2 = calculateStEDUAmount(HUNDRED_EDU, INITIAL_INDEX);
      
      expect(await stEDU.balanceOf(users[0].address)).to.equal(expectedStEDU1);
      expect(await stEDU.balanceOf(users[1].address)).to.equal(expectedStEDU2);
      expect(await stEDU.totalStaked()).to.equal(expectedStEDU1 + expectedStEDU2);
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      // Stake some EDU first
      await stakeEDU(stEDU, users[0], HUNDRED_EDU);
    });

    it("Should allow users to unstake stEDU and receive EDU", async function () {
      const user = users[0];
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const initialEDUBalance = await ethers.provider.getBalance(user.address);
      
      // Get gas cost for accurate balance comparison
      const tx = await unstakeEDU(stEDU, user, stEDUBalance);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      const finalEDUBalance = await ethers.provider.getBalance(user.address);
      const expectedEDU = calculateEDUAmount(stEDUBalance, INITIAL_INDEX);
      
      // Account for gas costs in the comparison
      expect(finalEDUBalance + gasCost - initialEDUBalance).to.equal(expectedEDU);
    });

    it("Should update totalStaked and lastRecordedBalance correctly after unstaking", async function () {
      const user = users[0];
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const initialTotalStaked = await stEDU.totalStaked();
      const initialLastRecorded = await stEDU.lastRecordedBalance();
      
      await unstakeEDU(stEDU, user, stEDUBalance);
      
      expect(await stEDU.totalStaked()).to.equal(initialTotalStaked - stEDUBalance);
      
      const expectedEDU = calculateEDUAmount(stEDUBalance, INITIAL_INDEX);
      expect(await stEDU.lastRecordedBalance()).to.equal(initialLastRecorded - expectedEDU);
    });

    it("Should emit Unstaked event with correct parameters", async function () {
      const user = users[0];
      const stEDUAmount = await stEDU.balanceOf(user.address);
      const expectedEDU = calculateEDUAmount(stEDUAmount, INITIAL_INDEX);
      
      await expect(unstakeEDU(stEDU, user, stEDUAmount))
        .to.emit(stEDU, "Unstaked")
        .withArgs(user.address, expectedEDU, stEDUAmount);
    });

    it("Should revert when unstaking more than balance", async function () {
      const user = users[0];
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      await expect(unstakeEDU(stEDU, user, stEDUBalance + BigInt(1)))
        .to.be.revertedWith("Insufficient stEDU");
    });

    it("Should allow partial unstaking", async function () {
      const user = users[0];
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const unstakeAmount = stEDUBalance / BigInt(2);
      
      await unstakeEDU(stEDU, user, unstakeAmount);
      
      expect(await stEDU.balanceOf(user.address)).to.equal(stEDUBalance - unstakeAmount);
    });
  });

  describe("Rewards & Rebasing", function () {
    beforeEach(async function () {
      // Multiple users stake
      await stakeEDU(stEDU, users[0], HUNDRED_EDU);
      await stakeEDU(stEDU, users[1], HUNDRED_EDU);
    });

    it("Should allow owner to deposit rewards", async function () {
      const rewardAmount = TEN_EDU;
      
      await expect(depositRewards(stEDU, owner, rewardAmount))
        .to.not.be.reverted;
    });

    it("Should increase index proportionally to rewards", async function () {
      const totalStaked = await stEDU.totalStaked();
      const initialIndex = await stEDU.index();
      const rewardAmount = TEN_EDU;
      
      await depositRewards(stEDU, owner, rewardAmount);
      
      const expectedDeltaIndex = (rewardAmount * BigInt(1e18)) / totalStaked;
      const expectedNewIndex = initialIndex + expectedDeltaIndex;
      
      expect(await stEDU.index()).to.equal(expectedNewIndex);
    });

    it("Should update lastRecordedBalance correctly after rewards", async function () {
      const initialLastRecorded = await stEDU.lastRecordedBalance();
      const rewardAmount = TEN_EDU;
      
      await depositRewards(stEDU, owner, rewardAmount);
      
      expect(await stEDU.lastRecordedBalance()).to.equal(initialLastRecorded + rewardAmount);
    });

    it("Should emit RewardsDeposited event with correct parameters", async function () {
      const rewardAmount = TEN_EDU;
      const initialIndex = await stEDU.index();
      const totalStaked = await stEDU.totalStaked();
      
      const expectedDeltaIndex = (rewardAmount * BigInt(1e18)) / totalStaked;
      const expectedNewIndex = initialIndex + expectedDeltaIndex;
      
      await expect(depositRewards(stEDU, owner, rewardAmount))
        .to.emit(stEDU, "RewardsDeposited")
        .withArgs(owner.address, rewardAmount, expectedNewIndex);
    });

    it("Should revert when non-owner tries to deposit rewards", async function () {
      const user = users[0];
      const rewardAmount = TEN_EDU;
      
      await expect(depositRewards(stEDU, user, rewardAmount))
        .to.be.revertedWithCustomError(stEDU, "OwnableUnauthorizedAccount");
    });

    it("Should revert when depositing zero rewards", async function () {
      await expect(depositRewards(stEDU, owner, 0))
        .to.be.revertedWith("No reward sent");
    });

    it("Should revert when depositing rewards with nothing staked", async function () {
      // Deploy a fresh contract
      const StEDU = await ethers.getContractFactory("stEDU");
      const freshStEDU = await StEDU.deploy();
      
      await expect(depositRewards(freshStEDU, owner, TEN_EDU))
        .to.be.revertedWith("Nothing staked");
    });

    it("Should maintain correct stEDU value after rebasing", async function () {
      const user = users[0];
      const initialStEDUBalance = await stEDU.balanceOf(user.address);
      const initialIndex = await stEDU.index();
      
      // Deposit rewards to trigger rebase
      await depositRewards(stEDU, owner, TEN_EDU);
      
      const newIndex = await stEDU.index();
      
      // stEDU balance should remain the same
      expect(await stEDU.balanceOf(user.address)).to.equal(initialStEDUBalance);
      
      // But the EDU value should increase
      const initialEDUValue = calculateEDUAmount(initialStEDUBalance, initialIndex);
      const newEDUValue = calculateEDUAmount(initialStEDUBalance, newIndex);
      
      expect(newEDUValue).to.be.gt(initialEDUValue);
    });
  });

  describe("Delegation", function () {
    it("Should allow users to delegate to another address", async function () {
      const delegator = users[0];
      const delegatee = users[1];
      
      await stEDU.connect(delegator).delegate(delegatee.address);
      
      expect(await stEDU.delegation(delegator.address)).to.equal(delegatee.address);
    });

    it("Should emit DelegateChanged event with correct parameters", async function () {
      const delegator = users[0];
      const delegatee = users[1];
      
      await expect(stEDU.connect(delegator).delegate(delegatee.address))
        .to.emit(stEDU, "DelegateChanged")
        .withArgs(delegator.address, delegatee.address);
    });

    it("Should revert when delegating to zero address", async function () {
      const delegator = users[0];
      const zeroAddress = ethers.ZeroAddress;
      
      await expect(stEDU.connect(delegator).delegate(zeroAddress))
        .to.be.revertedWith("Invalid delegatee");
    });

    it("Should allow changing delegation", async function () {
      const delegator = users[0];
      const delegatee1 = users[1];
      const delegatee2 = users[2];
      
      await stEDU.connect(delegator).delegate(delegatee1.address);
      expect(await stEDU.delegation(delegator.address)).to.equal(delegatee1.address);
      
      await stEDU.connect(delegator).delegate(delegatee2.address);
      expect(await stEDU.delegation(delegator.address)).to.equal(delegatee2.address);
    });
  });

  describe("Admin Withdrawal", function () {
    beforeEach(async function () {
      // Stake some EDU to have funds in the contract
      await stakeEDU(stEDU, users[0], HUNDRED_EDU);
    });

    it("Should allow owner to withdraw EDU", async function () {
      const recipient = users[5];
      const withdrawAmount = TEN_EDU;
      const initialBalance = await ethers.provider.getBalance(recipient.address);
      
      await stEDU.connect(owner).adminWithdraw(recipient.address, withdrawAmount);
      
      const finalBalance = await ethers.provider.getBalance(recipient.address);
      expect(finalBalance - initialBalance).to.equal(withdrawAmount);
    });

    it("Should emit AdminWithdrawal event with correct parameters", async function () {
      const recipient = users[5];
      const withdrawAmount = TEN_EDU;
      
      await expect(stEDU.connect(owner).adminWithdraw(recipient.address, withdrawAmount))
        .to.emit(stEDU, "AdminWithdrawal")
        .withArgs(recipient.address, withdrawAmount);
    });

    it("Should revert when non-owner tries to withdraw", async function () {
      const user = users[0];
      const recipient = users[5];
      const withdrawAmount = TEN_EDU;
      
      await expect(stEDU.connect(user).adminWithdraw(recipient.address, withdrawAmount))
        .to.be.revertedWithCustomError(stEDU, "OwnableUnauthorizedAccount");
    });

    it("Should revert when withdrawing to zero address", async function () {
      const zeroAddress = ethers.ZeroAddress;
      const withdrawAmount = TEN_EDU;
      
      await expect(stEDU.connect(owner).adminWithdraw(zeroAddress, withdrawAmount))
        .to.be.revertedWith("Invalid recipient");
    });

    it("Should revert when withdrawing more than balance", async function () {
      const recipient = users[5];
      const contractBalance = await ethers.provider.getBalance(await stEDU.getAddress());
      const withdrawAmount = contractBalance + BigInt(1);
      
      await expect(stEDU.connect(owner).adminWithdraw(recipient.address, withdrawAmount))
        .to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Utility Functions", function () {
    beforeEach(async function () {
      // Stake some EDU first
      await stakeEDU(stEDU, users[0], HUNDRED_EDU);
    });

    it("Should correctly calculate EDU value from stEDU amount", async function () {
      const stEDUAmount = ethers.parseEther("10");
      const index = await stEDU.index();
      
      const expectedEDU = calculateEDUAmount(stEDUAmount, index);
      const contractEDU = await stEDU.stEDUToEDU(stEDUAmount);
      
      expect(contractEDU).to.equal(expectedEDU);
    });

    it("Should correctly handle receive function", async function () {
      const sender = users[0];
      const amount = ONE_EDU;
      const initialBalance = await ethers.provider.getBalance(await stEDU.getAddress());
      
      // Send EDU directly to contract
      await sender.sendTransaction({
        to: await stEDU.getAddress(),
        value: amount
      });
      
      const finalBalance = await ethers.provider.getBalance(await stEDU.getAddress());
      expect(finalBalance - initialBalance).to.equal(amount);
    });
  });
});
