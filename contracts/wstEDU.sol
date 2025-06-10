// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {stEDU} from "./stEDU.sol";

/// @title wstEDU: Non-Rebasing Wrapped stEDU Token for DeFi Use
contract wstEDU is ERC20, Ownable {
    stEDU public immutable stakeToken;

    constructor(
        address _stEDU
    ) ERC20("Wrapped Staked EDU", "wstEDU") Ownable(msg.sender) {
        stakeToken = stEDU(payable(_stEDU));
    }

    /// @notice Wrap stEDU into wstEDU (non-rebasing)
    function wrap(uint256 stEDUAmount) external returns (uint256) {
        require(stEDUAmount > 0, "Nothing to wrap");

        uint256 wstEDUAmount = (stEDUAmount * 1e18) / stakeToken.index();
        stakeToken.transferFrom(msg.sender, address(this), stEDUAmount);
        _mint(msg.sender, wstEDUAmount);

        return wstEDUAmount;
    }

    /// @notice Unwrap wstEDU back into stEDU
    function unwrap(uint256 wstEDUAmount) external returns (uint256) {
        require(wstEDUAmount > 0, "Nothing to unwrap");

        // Calculate what percentage of total wstEDU supply is being unwrapped
        // Then return that same percentage of the contract's stEDU balance
        uint256 totalwstEDU = totalSupply();
        uint256 stEDUBalance = stakeToken.balanceOf(address(this));

        // Calculate stEDU to return based on proportion
        uint256 stEDUAmount = (wstEDUAmount * stEDUBalance) / totalwstEDU;

        _burn(msg.sender, wstEDUAmount);

        // Transfer stEDU back to the user
        stakeToken.transfer(msg.sender, stEDUAmount);

        return stEDUAmount;
    }

    /// @notice Get the current stEDU value of 1 wstEDU
    function stEDUPerToken() public view returns (uint256) {
        return (1e18 * stakeToken.index()) / 1e18;
    }

    /// @notice Get current value in EDU for a given wstEDU amount
    function wstEDUToEDU(uint256 wstEDUAmount) external view returns (uint256) {
        uint256 totalwstEDU = totalSupply();
        
        // If no wstEDU tokens exist, return 0
        if (totalwstEDU == 0) return 0;
        
        uint256 stEDUBalance = stakeToken.balanceOf(address(this));
        
        // Calculate stEDU amount (same as in unwrap)
        uint256 stEDUAmount = (wstEDUAmount * stEDUBalance) / totalwstEDU;
        
        // Calculate EDU value (same as in stEDU.unstake)
        return (stEDUAmount * stakeToken.index()) / 1e18;
    }

    /// @notice Get the stEDU amount that would be returned for a given wstEDU amount
    function getStEDUAmount(uint256 wstEDUAmount) public view returns (uint256) {
        uint256 totalwstEDU = totalSupply();
        if (totalwstEDU == 0) return 0;
        uint256 stEDUBalance = stakeToken.balanceOf(address(this));
        return (wstEDUAmount * stEDUBalance) / totalwstEDU;
    }
}
