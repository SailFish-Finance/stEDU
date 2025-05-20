// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {stEDU} from "./stEDU.sol";

/// @title MaliciousReceiver: Contract for testing reentrancy protection
contract MaliciousReceiver {
    stEDU public immutable target;
    bool public attacking = false;
    
    constructor(address _target) {
        target = stEDU(payable(_target));
    }
    
    function attackUnstake(uint256 amount) external {
        target.unstake(amount);
    }
    
    function attackAdminWithdraw() external {
        // This function would be called by the contract owner
        // to test reentrancy in adminWithdraw
        // The actual attack happens in the receive function
    }
    
    receive() external payable {
        if (!attacking) {
            attacking = true;
            // Try to call unstake again during the first unstake
            // or try to call adminWithdraw during an adminWithdraw
            try target.unstake(1) {
                // If this succeeds, the reentrancy protection failed
            } catch {
                // Expected to fail due to reentrancy protection
            }
            attacking = false;
        }
    }
}
