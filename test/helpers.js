const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Constants
const INITIAL_INDEX = ethers.parseEther("1"); // 1e18
const UNSTAKE_DELAY = 7 * 24 * 60 * 60; // 7 days in seconds
const ONE_EDU = ethers.parseEther("1");
const TEN_EDU = ethers.parseEther("10");
const HUNDRED_EDU = ethers.parseEther("100");

/**
 * Deploy all contracts needed for testing
 * @returns {Promise<Object>} Deployed contract instances and signers
 */
async function deployContracts() {
  const [owner, ...users] = await ethers.getSigners();

  // Deploy MockWEDU contract
  const MockWEDU = await ethers.getContractFactory("MockWEDU");
  const mockWEDU = await MockWEDU.deploy();

  // Deploy stEDU contract with MockWEDU address
  const StEDU = await ethers.getContractFactory("stEDU");
  const stEDU = await StEDU.deploy(await mockWEDU.getAddress());

  return { mockWEDU, stEDU, owner, users };
}

/**
 * Advance time in the blockchain
 * @param {number} seconds Number of seconds to advance
 * @returns {Promise<void>}
 */
async function advanceTime(seconds) {
  await time.increase(seconds);
}

/**
 * Advance time to after the unstake delay
 * @returns {Promise<void>}
 */
async function advanceTimeAfterUnstakeDelay() {
  await advanceTime(UNSTAKE_DELAY + 1);
}

/**
 * Calculate expected stEDU amount based on EDU amount and index
 * @param {BigInt} eduAmount Amount of EDU
 * @param {BigInt} index Current index
 * @returns {BigInt} Expected stEDU amount
 */
function calculateStEDUAmount(eduAmount, index) {
  return (eduAmount * ethers.parseEther("1")) / index;
}

/**
 * Calculate expected EDU amount based on stEDU amount and index
 * @param {BigInt} stEDUAmount Amount of stEDU
 * @param {BigInt} index Current index
 * @returns {BigInt} Expected EDU amount
 */
function calculateEDUAmount(stEDUAmount, index) {
  return (stEDUAmount * index) / ethers.parseEther("1");
}

/**
 * Calculate expected index increase after rewards
 * @param {BigInt} rewardAmount Amount of rewards
 * @param {BigInt} totalSupply Total supply of stEDU
 * @returns {BigInt} Expected index increase
 */
function calculateIndexIncrease(rewardAmount, totalSupply) {
  return (rewardAmount * ethers.parseEther("1")) / totalSupply;
}

/**
 * Format BigInt to string with specified decimals
 * @param {BigInt} value Value to format
 * @param {number} decimals Number of decimals
 * @returns {string} Formatted string
 */
function formatBigInt(value, decimals = 18) {
  const divisor = BigInt(10) ** BigInt(decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  // Pad the fractional part with leading zeros if needed
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  
  return `${integerPart}.${fractionalStr}`;
}

module.exports = {
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
  formatBigInt
};
