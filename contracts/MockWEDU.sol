// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockWEDU
 * @dev Mock Wrapped EDU for testing
 */
contract MockWEDU is ERC20 {
    constructor() ERC20("Wrapped EDU", "WEDU") {}

    /**
     * @dev Deposit native EDU and mint WEDU tokens
     */
    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw native EDU by burning WEDU tokens
     * @param amount Amount of WEDU tokens to burn
     */
    function withdraw(uint256 amount) public {
        require(balanceOf(msg.sender) >= amount, "WEDU: insufficient balance");
        _burn(msg.sender, amount);
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "WEDU: transfer failed");
    }

    /**
     * @dev Fallback function to handle native EDU deposits
     */
    receive() external payable {
        deposit();
    }
}
