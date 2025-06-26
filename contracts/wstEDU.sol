// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title wstEDU — 1‑to‑1 wrapper around stEDU shares
/// @notice This contract simply locks stEDU and issues an equal amount of non‑rebasing wstEDU.
///         • 1 stEDU in  →  1 wstEDU minted
///         • 1 wstEDU out →  1 stEDU returned
/// @dev Designed for protocols like Blend that prefer an ERC‑20 without time locks.
contract wstEDU is ERC20, Ownable, ReentrancyGuard {
    IERC20 public immutable stEDU;

    event Wrapped  (address indexed user, uint256 amount);
    event Unwrapped(address indexed user, uint256 amount);

    constructor(IERC20 _stEDU) ERC20("Wrapped stEDU", "wstEDU")  Ownable(msg.sender) {
        stEDU = _stEDU;
    }

    /// @notice Wrap `amount` stEDU and receive the same amount of wstEDU.
    function wrap(uint256 amount) external nonReentrant returns (uint256) {
        require(amount > 0, "amount = 0");
        stEDU.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        emit Wrapped(msg.sender, amount);
        return amount;
    }

    /// @notice Unwrap `amount` wstEDU and receive the same amount of stEDU.
    function unwrap(uint256 amount) external nonReentrant returns (uint256) {
        require(amount > 0, "amount = 0");
        _burn(msg.sender, amount);
        stEDU.transfer(msg.sender, amount);
        emit Unwrapped(msg.sender, amount);
        return amount;
    }

    /// @notice Convenient helper: convert wstEDU amount to stEDU (1:1).
    function wstEDUToStEDU(uint256 wAmount) external pure returns (uint256) {
        return wAmount; // 1:1 ratio
    }

    /// @notice Convenient helper: convert stEDU amount to wstEDU (1:1).
    function stEDUToWstEDU(uint256 sAmount) external pure returns (uint256) {
        return sAmount; // 1:1 ratio
    }

    /*//////////////////////////////////////////////////////////////
                          OWNER RECOVERY FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /// @dev Allows the owner to rescue any ERC‑20 tokens (except stEDU) sent by accident.
    function rescueERC20(IERC20 token, uint256 amount, address to) external onlyOwner {
        require(token != stEDU, "stEDU locked");
        token.transfer(to, amount);
    }
}
