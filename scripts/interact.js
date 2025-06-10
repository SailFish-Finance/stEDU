// We require the Hardhat Runtime Environment explicitly here.
const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  // Contract addresses from deployment
  const stEDUAddress = "0x54565fFBd8e6c5b6AF4bbaFDB544Afb915CB58D9";
  const wstEDUAddress = "0x4D94109fA2fFb73f299505053A5bC03Fc3cB6547";

  console.log("Connecting to contracts on opencampus network...");

  // Get contract instances
  const stEDU = await ethers.getContractAt("stEDU", stEDUAddress);
  const wstEDU = await ethers.getContractAt("wstEDU", wstEDUAddress);

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);

  // Get initial state
  const initialIndex = await stEDU.index();
  console.log(`Initial stEDU index: ${ethers.formatUnits(initialIndex, 18)}`);

  // Stake some EDU
  const stakeAmount = ethers.parseEther("500"); // 500 EDU
  console.log(`Staking ${ethers.formatEther(stakeAmount)} EDU...`);
  const stakeTx = await stEDU.stake({ value: stakeAmount });
  await stakeTx.wait();

  // Check stEDU balance
  const stEDUBalance = await stEDU.balanceOf(signer.address);
  console.log(
    `stEDU balance after staking: ${ethers.formatEther(stEDUBalance)}`
  );

  // Approve wstEDU to spend stEDU
  console.log(`Approving wstEDU to spend stEDU...`);
  const approveTx = await stEDU.approve(wstEDUAddress, stEDUBalance);
  await approveTx.wait();

  // Wrap stEDU to wstEDU
  console.log(
    `Wrapping ${ethers.formatEther(stEDUBalance)} stEDU to wstEDU...`
  );
  const wrapTx = await wstEDU.wrap(stEDUBalance);
  await wrapTx.wait();

  // Check wstEDU balance
  const wstEDUBalance = await wstEDU.balanceOf(signer.address);
  console.log(
    `wstEDU balance after wrapping: ${ethers.formatEther(wstEDUBalance)}`
  );

  // Check EDU value of wstEDU
  const eduValueBefore = await wstEDU.wstEDUToEDU(wstEDUBalance);
  console.log(
    `EDU value of wstEDU before rewards: ${ethers.formatEther(eduValueBefore)}`
  );

  // Deposit rewards (if owner)
  try {
    const owner = await stEDU.owner();
    if (owner.toLowerCase() === signer.address.toLowerCase()) {
      console.log("Account is the owner, depositing rewards...");
      const rewardAmount = ethers.parseEther("5"); // 5 EDU
      const rewardTx = await stEDU.depositRewards({ value: rewardAmount });
      await rewardTx.wait();

      // Check new index
      const newIndex = await stEDU.index();
      console.log(
        `New stEDU index after rewards: ${ethers.formatUnits(newIndex, 18)}`
      );
      console.log(
        `Index increased by: ${ethers.formatUnits(newIndex - initialIndex, 18)}`
      );

      // Check EDU value of wstEDU after rewards
      const eduValueAfter = await wstEDU.wstEDUToEDU(wstEDUBalance);
      console.log(
        `EDU value of wstEDU after rewards: ${ethers.formatEther(
          eduValueAfter
        )}`
      );
      console.log(
        `EDU value increased by: ${ethers.formatEther(
          eduValueAfter - eduValueBefore
        )}`
      );
    } else {
      console.log("Account is not the owner, skipping reward deposit");
    }
  } catch (error) {
    console.error("Error depositing rewards:", error.message);
  }

  // Unwrap wstEDU back to stEDU
  console.log(
    `Unwrapping ${ethers.formatEther(wstEDUBalance)} wstEDU back to stEDU...`
  );
  const unwrapTx = await wstEDU.unwrap(wstEDUBalance);
  await unwrapTx.wait();

  // Check final stEDU balance
  const finalStEDUBalance = await stEDU.balanceOf(signer.address);
  console.log(
    `stEDU balance after unwrapping: ${ethers.formatEther(finalStEDUBalance)}`
  );

  // Get balance before unstaking
  const balanceBeforeUnstake = await ethers.provider.getBalance(signer.address);

  // Unstake stEDU
  console.log(`Unstaking ${ethers.formatEther(finalStEDUBalance)} stEDU...`);
  const unstakeTx = await stEDU.unstake(finalStEDUBalance);
  const unstakeReceipt = await unstakeTx.wait();

  // Calculate gas cost
  const gasCost = unstakeReceipt.gasUsed * unstakeReceipt.gasPrice;

  // Get balance after unstaking
  const balanceAfterUnstake = await ethers.provider.getBalance(signer.address);

  // Calculate actual EDU received (accounting for gas costs)
  const eduReceived = balanceAfterUnstake + gasCost - balanceBeforeUnstake;
  console.log(
    `Actual EDU received from unstaking: ${ethers.formatEther(eduReceived)}`
  );

  // Check final state
  const finalStEDUSupply = await stEDU.totalSupply();
  console.log(
    `Final stEDU total supply: ${ethers.formatEther(finalStEDUSupply)}`
  );

  console.log("Interaction complete!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
