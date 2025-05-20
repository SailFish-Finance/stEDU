const { ethers } = require("hardhat");

/**
 * Helper functions for testing stEDU and wstEDU contracts
 */

/**
 * Deploy stEDU and wstEDU contracts
 * @returns {Promise<{stEDU: Contract, wstEDU: Contract, owner: Signer, users: Signer[]}>}
 */
async function deployContracts() {
  const [owner, ...users] = await ethers.getSigners();
  
  // Deploy stEDU contract
  const StEDU = await ethers.getContractFactory("stEDU");
  const stEDU = await StEDU.deploy();
  
  // Deploy wstEDU contract with stEDU address
  const WstEDU = await ethers.getContractFactory("wstEDU");
  const wstEDU = await WstEDU.deploy(await stEDU.getAddress());
  
  return { stEDU, wstEDU, owner, users };
}

/**
 * Helper to stake EDU and get stEDU
 * @param {Contract} stEDU - stEDU contract
 * @param {Signer} user - User signer
 * @param {BigNumber} amount - Amount of EDU to stake
 * @returns {Promise<TransactionReceipt>}
 */
async function stakeEDU(stEDU, user, amount) {
  return stEDU.connect(user).stake({ value: amount });
}

/**
 * Helper to unstake stEDU and get EDU
 * @param {Contract} stEDU - stEDU contract
 * @param {Signer} user - User signer
 * @param {BigNumber} amount - Amount of stEDU to unstake
 * @returns {Promise<TransactionReceipt>}
 */
async function unstakeEDU(stEDU, user, amount) {
  return stEDU.connect(user).unstake(amount);
}

/**
 * Helper to deposit rewards
 * @param {Contract} stEDU - stEDU contract
 * @param {Signer} owner - Owner signer
 * @param {BigNumber} amount - Amount of EDU to deposit as rewards
 * @returns {Promise<TransactionReceipt>}
 */
async function depositRewards(stEDU, owner, amount) {
  return stEDU.connect(owner).depositRewards({ value: amount });
}

/**
 * Helper to wrap stEDU to wstEDU
 * @param {Contract} stEDU - stEDU contract
 * @param {Contract} wstEDU - wstEDU contract
 * @param {Signer} user - User signer
 * @param {BigNumber} amount - Amount of stEDU to wrap
 * @returns {Promise<TransactionReceipt>}
 */
async function wrapStEDU(stEDU, wstEDU, user, amount) {
  // Approve wstEDU to spend stEDU
  await stEDU.connect(user).approve(await wstEDU.getAddress(), amount);
  // Wrap stEDU to wstEDU
  return wstEDU.connect(user).wrap(amount);
}

/**
 * Helper to unwrap wstEDU to stEDU
 * @param {Contract} wstEDU - wstEDU contract
 * @param {Signer} user - User signer
 * @param {BigNumber} amount - Amount of wstEDU to unwrap
 * @returns {Promise<TransactionReceipt>}
 */
async function unwrapWstEDU(wstEDU, user, amount) {
  return wstEDU.connect(user).unwrap(amount);
}

/**
 * Helper to get user's EDU balance
 * @param {Signer} user - User signer
 * @returns {Promise<BigNumber>}
 */
async function getEDUBalance(user) {
  return ethers.provider.getBalance(user.address);
}

/**
 * Helper to calculate expected stEDU amount from EDU amount
 * @param {BigNumber} eduAmount - Amount of EDU
 * @param {BigNumber} index - Current index
 * @returns {BigNumber}
 */
function calculateStEDUAmount(eduAmount, index) {
  return (eduAmount * BigInt(1e18)) / index;
}

/**
 * Helper to calculate expected EDU amount from stEDU amount
 * @param {BigNumber} stEDUAmount - Amount of stEDU
 * @param {BigNumber} index - Current index
 * @returns {BigNumber}
 */
function calculateEDUAmount(stEDUAmount, index) {
  return (stEDUAmount * index) / BigInt(1e18);
}

/**
 * Helper to calculate expected wstEDU amount from stEDU amount
 * @param {BigNumber} stEDUAmount - Amount of stEDU
 * @param {BigNumber} index - Current index
 * @returns {BigNumber}
 */
function calculateWstEDUAmount(stEDUAmount, index) {
  return (stEDUAmount * BigInt(1e18)) / index;
}

/**
 * Helper to calculate expected stEDU amount from wstEDU amount
 * @param {BigNumber} wstEDUAmount - Amount of wstEDU
 * @param {BigNumber} index - Current index
 * @returns {BigNumber}
 */
function calculateStEDUFromWstEDU(wstEDUAmount, index) {
  return (wstEDUAmount * index) / BigInt(1e18);
}

/**
 * Helper to calculate APY based on index change
 * @param {BigNumber} startIndex - Starting index
 * @param {BigNumber} endIndex - Ending index
 * @param {Number} daysElapsed - Days elapsed
 * @returns {Number} - APY as a percentage
 */
function calculateAPY(startIndex, endIndex, daysElapsed) {
  const indexRatio = Number(endIndex) / Number(startIndex);
  const annualizedRatio = Math.pow(indexRatio, 365 / daysElapsed);
  return (annualizedRatio - 1) * 100;
}

module.exports = {
  deployContracts,
  stakeEDU,
  unstakeEDU,
  depositRewards,
  wrapStEDU,
  unwrapWstEDU,
  getEDUBalance,
  calculateStEDUAmount,
  calculateEDUAmount,
  calculateWstEDUAmount,
  calculateStEDUFromWstEDU,
  calculateAPY
};
