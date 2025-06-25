// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MaliciousReceiver
 * @dev Contract used for testing reentrancy attacks
 */
contract MaliciousReceiver {
    address public immutable stEDU;
    bool public attacking;

    constructor(address _stEDU) {
        stEDU = _stEDU;
    }

    /**
     * @dev Receive function to accept EDU
     */
    receive() external payable {
        // Try to reenter if we're in the middle of an attack
        if (attacking) {
            // Call unstake again to attempt reentrancy
            stEDU.call(abi.encodeWithSignature("unstake(uint256)", 1));
            // We don't care if it succeeds, we're just testing if reentrancy is possible
        }
    }

    /**
     * @dev Attack function that attempts reentrancy
     * @param amount Amount of stEDU to unstake
     */
    function attackUnstake(uint256 amount) external {
        attacking = true;
        // Call unstake, which will send EDU back to this contract
        // During the receive function, we'll try to reenter
        stEDU.call(abi.encodeWithSignature("unstake(uint256)", amount));
        attacking = false;
    }
}
