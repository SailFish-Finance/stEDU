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

        uint256 stEDUAmount = (wstEDUAmount * stakeToken.index()) / 1e18;
        _burn(msg.sender, wstEDUAmount);
        require(
            stakeToken.balanceOf(address(this)) >= stEDUAmount,
            "Insufficient stEDU in wrapper"
        );

        return stEDUAmount;
    }

    /// @notice Get the current stEDU value of 1 wstEDU
    function stEDUPerToken() public view returns (uint256) {
        return (1e18 * stakeToken.index()) / 1e18;
    }

    /// @notice Get current value in EDU for a given wstEDU amount
    function eduValue(uint256 wstEDUAmount) external view returns (uint256) {
        return (wstEDUAmount * stakeToken.index()) / 1e18;
    }

    function getStEDUAmount(
        uint256 wstEDUAmount
    ) public view returns (uint256) {
        return (wstEDUAmount * stakeToken.index()) / 1e18;
    }
}
