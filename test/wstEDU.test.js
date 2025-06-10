const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  deployContracts,
  stakeEDU,
  wrapStEDU,
  unwrapWstEDU,
  calculateStEDUAmount,
  calculateWstEDUAmount,
  calculateStEDUFromWstEDU
} = require("./helpers");

describe("wstEDU Contract", function () {
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

  describe("Deployment", function () {
    it("Should initialize with correct name and symbol", async function () {
      expect(await wstEDU.name()).to.equal("Wrapped Staked EDU");
      expect(await wstEDU.symbol()).to.equal("wstEDU");
    });

    it("Should set stEDU reference correctly", async function () {
      expect(await wstEDU.stakeToken()).to.equal(await stEDU.getAddress());
    });

    it("Should set the owner correctly", async function () {
      expect(await wstEDU.owner()).to.equal(owner.address);
    });
  });

  describe("Wrapping", function () {
    beforeEach(async function () {
      // Stake some EDU first to get stEDU
      await stakeEDU(stEDU, users[0], HUNDRED_EDU);
    });

    it("Should allow users to wrap stEDU and receive wstEDU", async function () {
      const user = users[0];
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const initialWstEDUBalance = await wstEDU.balanceOf(user.address);
      
      await wrapStEDU(stEDU, wstEDU, user, stEDUBalance);
      
      const finalWstEDUBalance = await wstEDU.balanceOf(user.address);
      const expectedWstEDU = calculateWstEDUAmount(stEDUBalance, INITIAL_INDEX);
      
      expect(finalWstEDUBalance - initialWstEDUBalance).to.equal(expectedWstEDU);
    });

    it("Should transfer stEDU to the wstEDU contract", async function () {
      const user = users[0];
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const initialContractBalance = await stEDU.balanceOf(await wstEDU.getAddress());
      
      await wrapStEDU(stEDU, wstEDU, user, stEDUBalance);
      
      const finalContractBalance = await stEDU.balanceOf(await wstEDU.getAddress());
      expect(finalContractBalance - initialContractBalance).to.equal(stEDUBalance);
    });

    it("Should revert when wrapping zero stEDU", async function () {
      const user = users[0];
      
      await expect(wrapStEDU(stEDU, wstEDU, user, 0))
        .to.be.revertedWith("Nothing to wrap");
    });

    it("Should revert when wrapping without sufficient allowance", async function () {
      const user = users[0];
      const stEDUBalance = await stEDU.balanceOf(user.address);
      
      // Skip approval step
      await expect(wstEDU.connect(user).wrap(stEDUBalance))
        .to.be.reverted; // ERC20 insufficient allowance error
    });

    it("Should allow partial wrapping", async function () {
      const user = users[0];
      const stEDUBalance = await stEDU.balanceOf(user.address);
      const wrapAmount = stEDUBalance / BigInt(2);
      
      await wrapStEDU(stEDU, wstEDU, user, wrapAmount);
      
      expect(await stEDU.balanceOf(user.address)).to.equal(stEDUBalance - wrapAmount);
      
      const expectedWstEDU = calculateWstEDUAmount(wrapAmount, INITIAL_INDEX);
      expect(await wstEDU.balanceOf(user.address)).to.equal(expectedWstEDU);
    });

    it("Should return correct amount of wstEDU from wrap function", async function () {
      const user = users[0];
      const stEDUAmount = ethers.parseEther("10");
      
      // Approve first
      await stEDU.connect(user).approve(await wstEDU.getAddress(), stEDUAmount);
      
      // Call wrap directly to get return value
      const expectedWstEDU = calculateWstEDUAmount(stEDUAmount, INITIAL_INDEX);
      const returnedWstEDU = await wstEDU.connect(user).wrap.staticCall(stEDUAmount);
      
      expect(returnedWstEDU).to.equal(expectedWstEDU);
    });
  });

  describe("Unwrapping", function () {
    beforeEach(async function () {
      // Stake some EDU first to get stEDU
      await stakeEDU(stEDU, users[0], HUNDRED_EDU);
      
      // Wrap stEDU to get wstEDU
      const stEDUBalance = await stEDU.balanceOf(users[0].address);
      await wrapStEDU(stEDU, wstEDU, users[0], stEDUBalance);
    });

    it("Should allow users to unwrap wstEDU and receive stEDU", async function () {
      const user = users[0];
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      const initialStEDUBalance = await stEDU.balanceOf(user.address);
      
      await unwrapWstEDU(wstEDU, user, wstEDUBalance);
      
      const finalStEDUBalance = await stEDU.balanceOf(user.address);
      const expectedStEDU = calculateStEDUFromWstEDU(wstEDUBalance, INITIAL_INDEX);
      
      expect(finalStEDUBalance - initialStEDUBalance).to.equal(expectedStEDU);
    });

    it("Should burn wstEDU tokens when unwrapping", async function () {
      const user = users[0];
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      
      await unwrapWstEDU(wstEDU, user, wstEDUBalance);
      
      expect(await wstEDU.balanceOf(user.address)).to.equal(0);
    });

    it("Should revert when unwrapping zero wstEDU", async function () {
      const user = users[0];
      
      await expect(unwrapWstEDU(wstEDU, user, 0))
        .to.be.revertedWith("Nothing to unwrap");
    });

    it("Should revert when contract has insufficient stEDU", async function () {
      // For this test, we'll create a mock scenario where the contract has insufficient stEDU
      
      // First, let's get the current wstEDU balance of the user
      const user = users[0];
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      
      // Let's unwrap half of it to get some stEDU back
      const halfWstEDU = wstEDUBalance / BigInt(2);
      await unwrapWstEDU(wstEDU, user, halfWstEDU);
      
      // Now, let's simulate a scenario where the contract has lost some stEDU
      // We'll do this by deploying a mock contract that points to the same stEDU
      const MockWstEDU = await ethers.getContractFactory("MockWstEDU");
      const mockWstEDU = await MockWstEDU.deploy(await stEDU.getAddress());
      
      // Transfer the remaining wstEDU to the user in the mock contract
      // This is just for the test and wouldn't be possible in reality
      const remainingWstEDU = await wstEDU.balanceOf(user.address);
      await mockWstEDU.connect(owner).mint(user.address, remainingWstEDU);
      
      // Now try to unwrap from the mock contract which has no stEDU
      await expect(mockWstEDU.connect(user).unwrap(remainingWstEDU))
        .to.be.revertedWith("Insufficient stEDU in wrapper");
    });

    it("Should allow partial unwrapping", async function () {
      const user = users[0];
      const wstEDUBalance = await wstEDU.balanceOf(user.address);
      const unwrapAmount = wstEDUBalance / BigInt(2);
      
      await unwrapWstEDU(wstEDU, user, unwrapAmount);
      
      expect(await wstEDU.balanceOf(user.address)).to.equal(wstEDUBalance - unwrapAmount);
      
      const expectedStEDU = calculateStEDUFromWstEDU(unwrapAmount, INITIAL_INDEX);
      const initialStEDUBalance = BigInt(0); // User wrapped all stEDU
      expect(await stEDU.balanceOf(user.address)).to.equal(initialStEDUBalance + expectedStEDU);
    });

    it("Should return correct amount of stEDU from unwrap function", async function () {
      const user = users[0];
      const wstEDUAmount = ethers.parseEther("5");
      
      // Call unwrap directly to get return value
      const expectedStEDU = calculateStEDUFromWstEDU(wstEDUAmount, INITIAL_INDEX);
      const returnedStEDU = await wstEDU.connect(user).unwrap.staticCall(wstEDUAmount);
      
      expect(returnedStEDU).to.equal(expectedStEDU);
    });
  });

  describe("Utility Functions", function () {
    beforeEach(async function () {
      // Stake some EDU first to get stEDU
      await stakeEDU(stEDU, users[0], HUNDRED_EDU);
    });

    it("Should correctly calculate stEDUPerToken", async function () {
      const index = await stEDU.index();
      const expectedStEDUPerToken = (BigInt(1e18) * index) / BigInt(1e18);
      
      expect(await wstEDU.stEDUPerToken()).to.equal(expectedStEDUPerToken);
    });

    it("Should correctly calculate EDU value for wstEDU", async function () {
      // First, wrap some stEDU to have a non-zero totalSupply
      const user = users[0];
      const stEDUBalance = await stEDU.balanceOf(user.address);
      await wrapStEDU(stEDU, wstEDU, user, stEDUBalance);
      
      const wstEDUAmount = ethers.parseEther("10");
      
      // With our new implementation, wstEDUToEDU calculates based on the proportion
      // of the total wstEDU supply, so we need to have some stEDU in the contract
      const wstEDUToEDUValue = await wstEDU.wstEDUToEDU(wstEDUAmount);
      
      // The expected value should be proportional to the amount of stEDU in the contract
      const totalWstEDU = await wstEDU.totalSupply();
      const stEDUInContract = await stEDU.balanceOf(await wstEDU.getAddress());
      const expectedStEDU = (wstEDUAmount * stEDUInContract) / totalWstEDU;
      const expectedEDUValue = (expectedStEDU * await stEDU.index()) / BigInt(1e18);
      
      expect(wstEDUToEDUValue).to.equal(expectedEDUValue);
    });

    it("Should correctly calculate stEDU amount from wstEDU", async function () {
      // First, wrap some stEDU to have a non-zero totalSupply
      const user = users[0];
      const stEDUBalance = await stEDU.balanceOf(user.address);
      await wrapStEDU(stEDU, wstEDU, user, stEDUBalance);
      
      const wstEDUAmount = ethers.parseEther("10");
      
      // With our new implementation, getStEDUAmount calculates based on the proportion
      // of the total wstEDU supply, so we need to have some stEDU in the contract
      const getStEDUValue = await wstEDU.getStEDUAmount(wstEDUAmount);
      
      // The expected value should be proportional to the amount of stEDU in the contract
      const totalWstEDU = await wstEDU.totalSupply();
      const stEDUInContract = await stEDU.balanceOf(await wstEDU.getAddress());
      const expectedStEDU = (wstEDUAmount * stEDUInContract) / totalWstEDU;
      
      expect(getStEDUValue).to.equal(expectedStEDU);
    });
  });
});
