const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  INITIAL_INDEX,
  UNSTAKE_DELAY,
  ONE_EDU,
  deployContracts
} = require("./helpers");

describe("stEDU Basic Tests", function () {
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

  describe("Initialization", function () {
    it("Should initialize with correct name and symbol", async function () {
      expect(await stEDU.name()).to.equal("Staked EDU");
      expect(await stEDU.symbol()).to.equal("stEDU");
    });

    it("Should initialize with correct asset", async function () {
      expect(await stEDU.asset()).to.equal(await mockWEDU.getAddress());
    });

    it("Should initialize with correct index", async function () {
      expect(await stEDU.index()).to.equal(INITIAL_INDEX);
    });

    it("Should initialize with correct unstake delay", async function () {
      expect(await stEDU.UNSTAKE_DELAY()).to.equal(UNSTAKE_DELAY);
    });

    it("Should set the correct owner", async function () {
      expect(await stEDU.owner()).to.equal(owner.address);
    });
  });

  describe("ERC4626 Compliance", function () {
    it("Should return the correct asset address", async function () {
      expect(await stEDU.asset()).to.equal(await mockWEDU.getAddress());
    });

    it("Should return the correct total assets", async function () {
      // Initially, there should be no assets
      expect(await stEDU.totalAssets()).to.equal(0);
    });

    it("Should convert assets to shares correctly", async function () {
      const assets = ONE_EDU;
      const expectedShares = (assets * ethers.parseEther("1")) / INITIAL_INDEX;
      expect(await stEDU.convertToShares(assets)).to.equal(expectedShares);
    });

    it("Should convert shares to assets correctly", async function () {
      const shares = ONE_EDU;
      const expectedAssets = (shares * INITIAL_INDEX) / ethers.parseEther("1");
      expect(await stEDU.convertToAssets(shares)).to.equal(expectedAssets);
    });

    it("Should revert on direct ERC4626 deposit calls", async function () {
      await expect(stEDU.deposit(ONE_EDU, users[0].address))
        .to.be.revertedWith("use stake/unstake");
    });

    it("Should revert on direct ERC4626 mint calls", async function () {
      await expect(stEDU.mint(ONE_EDU, users[0].address))
        .to.be.revertedWith("use stake/unstake");
    });

    it("Should revert on direct ERC4626 withdraw calls", async function () {
      await expect(stEDU.withdraw(ONE_EDU, users[0].address, users[0].address))
        .to.be.revertedWith("use stake/unstake");
    });

    it("Should revert on direct ERC4626 redeem calls", async function () {
      await expect(stEDU.redeem(ONE_EDU, users[0].address, users[0].address))
        .to.be.revertedWith("use stake/unstake");
    });
  });

  describe("Conversion Functions", function () {
    it("Should convert stEDU to EDU correctly", async function () {
      const stEDUAmount = ONE_EDU;
      const expectedEDUAmount = (stEDUAmount * INITIAL_INDEX) / ethers.parseEther("1");
      expect(await stEDU.stEDUToEDU(stEDUAmount)).to.equal(expectedEDUAmount);
    });

    it("Should convert EDU to stEDU correctly", async function () {
      const eduAmount = ONE_EDU;
      const expectedStEDUAmount = (eduAmount * ethers.parseEther("1")) / INITIAL_INDEX;
      expect(await stEDU.EDUToStEDU(eduAmount)).to.equal(expectedStEDUAmount);
    });

    it("Should maintain conversion consistency", async function () {
      const eduAmount = ONE_EDU;
      const stEDUAmount = await stEDU.EDUToStEDU(eduAmount);
      const convertedBackEDUAmount = await stEDU.stEDUToEDU(stEDUAmount);
      
      // Due to potential rounding, we check if it's very close
      expect(convertedBackEDUAmount).to.be.closeTo(eduAmount, 10);
    });
  });

  describe("Security Features", function () {
    it("Should allow owner to pause the contract", async function () {
      await stEDU.connect(owner).pause();
      expect(await stEDU.paused()).to.be.true;
    });

    it("Should allow owner to unpause the contract", async function () {
      await stEDU.connect(owner).pause();
      await stEDU.connect(owner).unpause();
      expect(await stEDU.paused()).to.be.false;
    });

    it("Should prevent non-owners from pausing", async function () {
      await expect(stEDU.connect(users[0]).pause())
        .to.be.revertedWithCustomError(stEDU, "OwnableUnauthorizedAccount");
    });

    it("Should prevent non-owners from unpausing", async function () {
      await stEDU.connect(owner).pause();
      await expect(stEDU.connect(users[0]).unpause())
        .to.be.revertedWithCustomError(stEDU, "OwnableUnauthorizedAccount");
    });
  });

  describe("Fallback Function", function () {
    it("Should accept direct EDU transfers", async function () {
      const sendAmount = ONE_EDU;
      await owner.sendTransaction({
        to: await stEDU.getAddress(),
        value: sendAmount
      });
      
      // Check contract balance
      expect(await ethers.provider.getBalance(await stEDU.getAddress())).to.equal(sendAmount);
    });
  });
});
