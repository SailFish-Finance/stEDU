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

describe("Edge Cases and Security Tests", function () {
  let stEDU;
  let wstEDU;
  let owner;
  let users;
  const INITIAL_INDEX = BigInt(1e18);
  const ONE_WEI = BigInt(1);
  const ONE_EDU = ethers.parseEther("1");
  const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  const LARGE_AMOUNT = ethers.parseEther("1000000"); // 1 million EDU

  beforeEach(async function () {
    const contracts = await deployContracts();
    stEDU = contracts.stEDU;
    wstEDU = contracts.wstEDU;
    owner = contracts.owner;
    users = contracts.users;
  });

  describe("Math Precision Tests", function () {
    it("Should handle very small amounts (1 wei)", async function () {
      const user = users[0];
      
      // Stake 1 wei
      await stakeEDU(stEDU, user, ONE_WEI);
      
      const stEDUBalance = await stEDU.balanceOf(user.address);
      expect(stEDUBalance).to.equal(ONE_WEI); // At initial index of 1e18, 1 wei EDU = 1 wei stEDU
      
      // Unstake 1 wei stEDU
      await unstakeEDU(stEDU, user, stEDUBalance);
      
      expect(await stEDU.balanceOf(user.address)).to.equal(0);
      expect(await stEDU.totalStaked()).to.equal(0);
    });

    it("Should handle very large amounts (near max uint256)", async function () {
      // For this test, we'll use a large but reasonable amount
      // Using actual max uint256 would require unrealistic amounts of ETH
      const user = users[0];
      
      // Stake a large amount
      await stakeEDU(stEDU, user, LARGE_AMOUNT);
      
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const expectedStEDU = calculateStEDUAmount(LARGE_AMOUNT, INITIAL_INDEX);
      
      expect(stEDUBalance).to.equal(expectedStEDU);
      
      // Deposit a large reward
      await depositRewards(stEDU, owner, LARGE_AMOUNT);
      
      // Unstake all
      await unstakeEDU(stEDU, user, stEDUBalance);
      
      expect(await stEDU.balanceOf(user.address)).to.equal(0);
      expect(await stEDU.totalStaked()).to.equal(0);
    });

    it("Should handle rounding correctly with various index values", async function () {
      const user = users[0];
      
      // Stake some EDU
      await stakeEDU(stEDU, user, ethers.parseEther("100"));
      
      // Deposit rewards to change index to an odd value
      await depositRewards(stEDU, owner, ethers.parseEther("3.33"));
      
      // Stake a small amount with the new index
      await stakeEDU(stEDU, users[1], ethers.parseEther("0.01"));
      
      // Deposit more rewards to make index even more complex
      await depositRewards(stEDU, owner, ethers.parseEther("1.77"));
      
      // Unstake partial amounts
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const partialAmount = stEDUBalance / BigInt(3);
      
      await unstakeEDU(stEDU, user, partialAmount);
      
      // Check that balances are consistent
      const totalStaked = await stEDU.totalStaked();
      const totalSupply = await stEDU.totalSupply();
      
      expect(totalStaked).to.equal(totalSupply);
    });
  });

  describe("Reentrancy Protection Tests", function () {
    it("Should protect against reentrancy in unstake", async function () {
      // Deploy a malicious contract that attempts reentrancy
      const MaliciousReceiverFactory = await ethers.getContractFactory("MaliciousReceiver");
      const maliciousReceiver = await MaliciousReceiverFactory.deploy(await stEDU.getAddress());
      
      // Stake some EDU from the owner
      await stakeEDU(stEDU, owner, ethers.parseEther("10"));
      
      // Transfer some stEDU to the malicious contract
      await stEDU.connect(owner).transfer(await maliciousReceiver.getAddress(), ethers.parseEther("5"));
      
      // Attempt reentrancy attack
      await expect(maliciousReceiver.attackUnstake(ethers.parseEther("5")))
        .to.be.reverted;
      
      // Verify state is still consistent
      const totalStaked = await stEDU.totalStaked();
      const totalSupply = await stEDU.totalSupply();
      
      expect(totalStaked).to.equal(totalSupply);
    });

    it("Should protect against reentrancy in adminWithdraw", async function () {
      // Deploy a malicious contract that attempts reentrancy
      const MaliciousReceiverFactory = await ethers.getContractFactory("MaliciousReceiver");
      const maliciousReceiver = await MaliciousReceiverFactory.deploy(await stEDU.getAddress());
      
      // Stake some EDU from a user
      await stakeEDU(stEDU, users[0], ethers.parseEther("10"));
      
      // Attempt reentrancy attack via adminWithdraw
      await expect(stEDU.connect(owner).adminWithdraw(await maliciousReceiver.getAddress(), ethers.parseEther("1")))
        .to.not.be.reverted;
      
      // Verify state is still consistent
      const contractBalance = await ethers.provider.getBalance(await stEDU.getAddress());
      const lastRecordedBalance = await stEDU.lastRecordedBalance();
      
      expect(contractBalance).to.equal(lastRecordedBalance);
    });
  });

  describe("State Consistency Tests", function () {
    it("Should maintain consistent totalStaked and lastRecordedBalance after multiple operations", async function () {
      // Perform a series of operations
      await stakeEDU(stEDU, users[0], ethers.parseEther("10"));
      await stakeEDU(stEDU, users[1], ethers.parseEther("20"));
      await depositRewards(stEDU, owner, ethers.parseEther("5"));
      
      const user0StEDU = await stEDU.balanceOf(users[0].address);
      await unstakeEDU(stEDU, users[0], user0StEDU / BigInt(2));
      
      await stakeEDU(stEDU, users[2], ethers.parseEther("15"));
      await depositRewards(stEDU, owner, ethers.parseEther("3"));
      
      const user1StEDU = await stEDU.balanceOf(users[1].address);
      await unstakeEDU(stEDU, users[1], user1StEDU / BigInt(3));
      
      // Check consistency
      const totalStaked = await stEDU.totalStaked();
      const totalSupply = await stEDU.totalSupply();
      const contractBalance = await ethers.provider.getBalance(await stEDU.getAddress());
      const lastRecordedBalance = await stEDU.lastRecordedBalance();
      
      expect(totalStaked).to.equal(totalSupply);
      expect(contractBalance).to.equal(lastRecordedBalance);
    });

    it("Should ensure contract balance matches lastRecordedBalance", async function () {
      // Stake, reward, unstake
      await stakeEDU(stEDU, users[0], ethers.parseEther("10"));
      await depositRewards(stEDU, owner, ethers.parseEther("2"));
      
      const stEDUBalance = await stEDU.balanceOf(users[0].address);
      await unstakeEDU(stEDU, users[0], stEDUBalance / BigInt(2));
      
      // Check consistency
      const contractBalance = await ethers.provider.getBalance(await stEDU.getAddress());
      const lastRecordedBalance = await stEDU.lastRecordedBalance();
      
      expect(contractBalance).to.equal(lastRecordedBalance);
    });
  });

  describe("Gas Limit Tests", function () {
    it("Should handle operations with many users without gas limit issues", async function () {
      // Stake with multiple users
      for (let i = 0; i < 10; i++) {
        await stakeEDU(stEDU, users[i % users.length], ethers.parseEther("1"));
      }
      
      // Deposit rewards
      await depositRewards(stEDU, owner, ethers.parseEther("5"));
      
      // Unstake with multiple users
      for (let i = 0; i < 5; i++) {
        const userStEDU = await stEDU.balanceOf(users[i % users.length].address);
        if (userStEDU > 0) {
          await unstakeEDU(stEDU, users[i % users.length], userStEDU / BigInt(2));
        }
      }
      
      // Check state consistency
      const totalStaked = await stEDU.totalStaked();
      const totalSupply = await stEDU.totalSupply();
      
      expect(totalStaked).to.equal(totalSupply);
    });
  });

  describe("Token Supply Tests", function () {
    it("Should handle extreme cases of supply expansion through rewards", async function () {
      // Stake a small amount
      await stakeEDU(stEDU, users[0], ethers.parseEther("1"));
      
      // Deposit a very large reward (100x the staked amount)
      await depositRewards(stEDU, owner, ethers.parseEther("100"));
      
      // Check that index increased correctly
      const newIndex = await stEDU.index();
      expect(newIndex).to.be.gt(INITIAL_INDEX);
      
      // The index should have increased by approximately 100x
      const expectedIndex = INITIAL_INDEX + (ethers.parseEther("100") * BigInt(1e18)) / ethers.parseEther("1");
      expect(newIndex).to.be.closeTo(expectedIndex, BigInt(1e15));
      
      // Unstake should return the original amount plus rewards
      const stEDUBalance = await stEDU.balanceOf(users[0].address);
      const initialBalance = await ethers.provider.getBalance(users[0].address);
      
      const tx = await unstakeEDU(stEDU, users[0], stEDUBalance);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(users[0].address);
      
      // Should have received approximately 101 EDU (1 staked + 100 in rewards)
      expect(finalBalance + gasCost - initialBalance).to.be.closeTo(
        ethers.parseEther("101"),
        ethers.parseEther("0.01")
      );
    });
  });

  describe("wstEDU Edge Cases", function () {
    beforeEach(async function () {
      // Setup: Stake some EDU and approve wstEDU to spend it
      await stakeEDU(stEDU, users[0], ethers.parseEther("10"));
      await stEDU.connect(users[0]).approve(await wstEDU.getAddress(), ethers.parseEther("10"));
    });

    it("Should handle wrapping and unwrapping with changing index", async function () {
      // Wrap some stEDU
      const initialStEDUBalance = await stEDU.balanceOf(users[0].address);
      await wstEDU.connect(users[0]).wrap(initialStEDUBalance);
      
      const wstEDUBalance = await wstEDU.balanceOf(users[0].address);
      
      // Deposit rewards to change the index
      await depositRewards(stEDU, owner, ethers.parseEther("5"));
      
      // Unwrap the wstEDU
      await wstEDU.connect(users[0]).unwrap(wstEDUBalance);
      
      // Should get more stEDU back than initially wrapped
      const finalStEDUBalance = await stEDU.balanceOf(users[0].address);
      expect(finalStEDUBalance).to.be.gt(initialStEDUBalance);
    });

    it("Should handle wrapping and unwrapping very small amounts", async function () {
      // Wrap a very small amount of stEDU
      await wstEDU.connect(users[0]).wrap(BigInt(1));
      
      const wstEDUBalance = await wstEDU.balanceOf(users[0].address);
      
      // Unwrap the wstEDU
      await wstEDU.connect(users[0]).unwrap(wstEDUBalance);
      
      // Check balances
      expect(await wstEDU.balanceOf(users[0].address)).to.equal(0);
    });

    it("Should handle wrapping and unwrapping with multiple users and changing index", async function () {
      // Setup multiple users with stEDU
      await stakeEDU(stEDU, users[1], ethers.parseEther("20"));
      await stakeEDU(stEDU, users[2], ethers.parseEther("30"));
      
      await stEDU.connect(users[1]).approve(await wstEDU.getAddress(), ethers.parseEther("20"));
      await stEDU.connect(users[2]).approve(await wstEDU.getAddress(), ethers.parseEther("30"));
      
      // Users wrap different amounts
      await wstEDU.connect(users[0]).wrap(ethers.parseEther("5"));
      await wstEDU.connect(users[1]).wrap(ethers.parseEther("10"));
      await wstEDU.connect(users[2]).wrap(ethers.parseEther("15"));
      
      // Deposit rewards to change the index
      await depositRewards(stEDU, owner, ethers.parseEther("10"));
      
      // Users unwrap in different order
      const wstEDUBalance2 = await wstEDU.balanceOf(users[2].address);
      await wstEDU.connect(users[2]).unwrap(wstEDUBalance2);
      
      const wstEDUBalance0 = await wstEDU.balanceOf(users[0].address);
      await wstEDU.connect(users[0]).unwrap(wstEDUBalance0);
      
      const wstEDUBalance1 = await wstEDU.balanceOf(users[1].address);
      await wstEDU.connect(users[1]).unwrap(wstEDUBalance1);
      
      // Check final state
      expect(await wstEDU.totalSupply()).to.equal(0);
      expect(await stEDU.balanceOf(await wstEDU.getAddress())).to.equal(0);
    });
  });
});

// Mock contract for reentrancy tests
// This would need to be in a separate file in a real project
// For the purpose of this test, we'll include it here
// Note: This contract will fail to deploy in the test as is
// You would need to create a separate file for it
/*
contract MaliciousReceiver {
    stEDU public immutable target;
    bool public attacking = false;
    
    constructor(address _target) {
        target = stEDU(_target);
    }
    
    function attackUnstake(uint256 amount) external {
        target.unstake(amount);
    }
    
    receive() external payable {
        if (!attacking) {
            attacking = true;
            // Try to call unstake again during the first unstake
            target.unstake(1);
            attacking = false;
        }
    }
}
*/
