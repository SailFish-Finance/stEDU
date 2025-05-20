// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title stEDU: Rebasing ERC20 Token for Staked Native EDU with Delegation and Admin Withdrawals
contract stEDU is ERC20, Ownable {
    uint256 public constant INITIAL_INDEX = 1e18;
    uint256 public index = INITIAL_INDEX;
    uint256 public totalStaked;
    uint256 public lastRecordedBalance;

    mapping(address => address) public delegation;

    event Staked(address indexed user, uint256 eduAmount, uint256 stEDUAmount);
    event Unstaked(address indexed user, uint256 eduReturned, uint256 stEDUBurned);
    event RewardsDeposited(address indexed caller, uint256 rewardAmount, uint256 newIndex);
    event DelegateChanged(address indexed delegator, address indexed delegatee);
    event AdminWithdrawal(address indexed to, uint256 amount);

    constructor() ERC20("Staked EDU", "stEDU") Ownable(msg.sender) {}

    /// @notice Stake native EDU and receive stEDU
    function stake() external payable {
        require(msg.value > 0, "Must send EDU");

        uint256 stEDUAmount = (msg.value * 1e18) / index;
        _mint(msg.sender, stEDUAmount);

        totalStaked += stEDUAmount;
        lastRecordedBalance += msg.value;

        emit Staked(msg.sender, msg.value, stEDUAmount);
    }

    /// @notice Unstake and receive native EDU based on current index
    function unstake(uint256 stEDUAmount) external {
        require(balanceOf(msg.sender) >= stEDUAmount, "Insufficient stEDU");

        uint256 eduToReturn = (stEDUAmount * index) / 1e18;

        _burn(msg.sender, stEDUAmount);
        totalStaked -= stEDUAmount;
        lastRecordedBalance -= eduToReturn;

        (bool sent, ) = msg.sender.call{value: eduToReturn}("");
        require(sent, "Transfer failed");

        emit Unstaked(msg.sender, eduToReturn, stEDUAmount);
    }

    /// @notice Deposit native EDU as rewards and trigger a rebase
    function depositRewards() external payable onlyOwner {
        require(msg.value > 0, "No reward sent");
        require(totalStaked > 0, "Nothing staked");

        uint256 newRewards = msg.value;
        uint256 deltaIndex = (newRewards * 1e18) / totalStaked;
        index += deltaIndex;

        lastRecordedBalance += newRewards;

        emit RewardsDeposited(msg.sender, newRewards, index);
    }

    /// @notice Delegate voting or protocol rights to another address
    function delegate(address delegatee) external {
        require(delegatee != address(0), "Invalid delegatee");
        delegation[msg.sender] = delegatee;
        emit DelegateChanged(msg.sender, delegatee);
    }

    /// @notice Admin can withdraw unused or emergency funds
    function adminWithdraw(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");

        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");

        emit AdminWithdrawal(to, amount);
    }

    /// @notice Return how much native EDU is redeemable per stEDU token
    function stEDUToEDU(uint256 stEDUAmount) external view returns (uint256) {
        return (stEDUAmount * index) / 1e18;
    }

    /// @notice Needed to accept native EDU
    receive() external payable {}
}