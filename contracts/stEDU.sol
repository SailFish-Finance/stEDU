// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface WEDU {
    function deposit() external payable;
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

/// @title stEDU – Fixed‑balance, index‑accruing wrapper for native EDU with a per‑deposit unbonding period
/// @notice   • Balances never rebase; `index` (share‑price) increases when rewards are pushed.
///           • Each individual stake is locked for `UNSTAKE_DELAY` to thwart front‑run / flash‑loan reward capture.
///           • External users MUST call {stake}/{unstake}. All ERC‑4626 entry points revert if called directly.
///           • `sync()` lets anyone fold accidental WEDU donations into `index`, ensuring no orphaned assets.
contract stEDU is ERC4626, Ownable, Pausable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/
    uint256 public constant INITIAL_INDEX  = 1e18;
    uint256 public constant UNSTAKE_DELAY  = 7 days; // per‑deposit unbonding period
    uint256 public maxRewardRate = 200; // 2% in basis points
    uint256 public constant MAX_DEPOSITS_PER_USER = 30;
    uint256 public constant MIN_STAKE_AMOUNT = 10;

    /*//////////////////////////////////////////////////////////////
                                  STATE
    //////////////////////////////////////////////////////////////*/
    uint256 public index = INITIAL_INDEX;          // share‑price, starts at 1 EDU per share
    WEDU    public immutable wedu;                 // wrapped native EDU token

    struct DepositInfo { uint256 shares; uint256 timestamp; }
    mapping(address => DepositInfo[]) private _deposits; // user FIFO buckets

    /*//////////////////////////////////////////////////////////////
                                  EVENTS
    //////////////////////////////////////////////////////////////*/
    event Staked      (address indexed user, uint256 eduAmount, uint256 stEDUAmount);
    event Unstaked    (address indexed user, uint256 eduReturned, uint256 stEDUBurned);
    event RewardsDeposited(address indexed caller, uint256 rewardAmount, uint256 newIndex);
    event SurplusSynced (uint256 surplusWEDU, uint256 newIndex);

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address _wedu)
        ERC4626(IERC20(_wedu))
        ERC20("Staked EDU", "stEDU")
        Ownable(msg.sender)
    {
        wedu = WEDU(_wedu);
    }

    /*//////////////////////////////////////////////////////////////
                            PAUSE / UNPAUSE
    //////////////////////////////////////////////////////////////*/
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /*//////////////////////////////////////////////////////////////
                                STAKING
    //////////////////////////////////////////////////////////////*/
    /// @notice Stake native EDU and mint stEDU. Each deposit is timestamped so it can be withdrawn after `UNSTAKE_DELAY`.
    function stake() external payable whenNotPaused nonReentrant returns (uint256) {
        require(msg.value >= MIN_STAKE_AMOUNT, "Minimum stake required");
        require(_deposits[msg.sender].length < MAX_DEPOSITS_PER_USER, "Max deposits reached");


        uint256 shares = (msg.value * 1e18) / index; // shares minted @ current price
        wedu.deposit{value: msg.value}();            // wrap EDU ➜ WEDU

        _mint(msg.sender, shares);
        _deposits[msg.sender].push(DepositInfo({shares: shares, timestamp: block.timestamp}));

        emit Staked(msg.sender, msg.value, shares);
        return shares;
    }

    /// @notice Unstake only the shares whose individual deposit timestamps are ≥ `UNSTAKE_DELAY`.
    function unstake(uint256 shares) external whenNotPaused nonReentrant returns (uint256) {
        require(shares > 0, "Zero shares");
        require(balanceOf(msg.sender) >= shares, "Insufficient stEDU");

        uint256 unlocked = 0;
        DepositInfo[] storage buckets = _deposits[msg.sender];
        uint256 len = buckets.length;
        for (uint256 i = 0; i < len && unlocked < shares; ) {
            DepositInfo storage b = buckets[i];
            if (block.timestamp - b.timestamp >= UNSTAKE_DELAY) {
                uint256 take = b.shares;
                if (unlocked + take > shares) take = shares - unlocked;
                b.shares -= take;
                unlocked += take;
                if (b.shares == 0) {
                    buckets[i] = buckets[buckets.length - 1];
                    buckets.pop();
                    len--; continue; // inspect element that got swapped in
                }
            }
            unchecked { ++i; }
        }
        require(unlocked == shares, "Requested amount still locked");

        _burn(msg.sender, shares);
        uint256 eduToReturn = (shares * index) / 1e18;
        wedu.withdraw(eduToReturn);
        (bool sent, ) = msg.sender.call{value: eduToReturn}("");
        require(sent, "Transfer failed");

        emit Unstaked(msg.sender, eduToReturn, shares);
        return eduToReturn;
    }

    /*//////////////////////////////////////////////////////////////
                                REWARDS
    //////////////////////////////////////////////////////////////*/
    /// @notice Push new EDU rewards; boosts `index`. Only callable by owner/treasury.
    function depositRewards() external payable onlyOwner whenNotPaused nonReentrant {
        require(msg.value > 0, "No reward sent");
        require(totalSupply() > 0, "Nothing staked");

        uint256 maxReward = (totalAssets() * maxRewardRate) / 10000;
        require(msg.value <= maxReward, "Reward exceeds cap");

        wedu.deposit{value: msg.value}();
        uint256 deltaIndex = (msg.value * 1e18) / totalSupply();
        index += deltaIndex;
        emit RewardsDeposited(msg.sender, msg.value, index);
    }

    /*//////////////////////////////////////////////////////////////
                            SURPLUS SYNC
    //////////////////////////////////////////////////////////////*/
    /// @notice Fold any extra WEDU accidentally sent to the vault into `index`, so stakers benefit instead of leaving
    ///         the tokens stranded. Callable by anyone.
    function sync() external whenNotPaused nonReentrant {
        uint256 expected = (index * totalSupply()) / 1e18;
        uint256 actual   = wedu.balanceOf(address(this));
        require(actual > expected, "No surplus");
        uint256 surplus  = actual - expected;
        require(totalSupply() > 0, "No shares");

        index += (surplus * 1e18) / totalSupply();
        emit SurplusSynced(surplus, index);
    }

    /*//////////////////////////////////////////////////////////////
                     ERC‑4626 EXTERNAL ENTRY POINTS – DISABLED
    //////////////////////////////////////////////////////////////*/
    /// @dev External users/protocols must call {stake}/{unstake}. These reverts prevent bypassing the lock.
    function deposit(uint256, address) public pure override returns (uint256) {
        revert("use stake/unstake");
    }
    function mint(uint256, address) public pure override returns (uint256) {
        revert("use stake/unstake");
    }
    function withdraw(uint256, address, address) public pure override returns (uint256) {
        revert("use stake/unstake");
    }
    function redeem(uint256, address, address) public pure override returns (uint256) {
        revert("use stake/unstake");
    }

    /*//////////////////////////////////////////////////////////////
                    VIEW FUNCTIONS & 4626 CONVERSIONS
    //////////////////////////////////////////////////////////////*/
    function totalAssets() public view override returns (uint256) {
        return wedu.balanceOf(address(this));
    }
    function convertToShares(uint256 assets) public view override returns (uint256) {
        return (assets * 1e18) / index;
    }
    function convertToAssets(uint256 shares) public view override returns (uint256) {
        return (shares * index) / 1e18;
    }
    function stEDUToEDU(uint256 stEDUAmount) external view returns (uint256) {
        return (stEDUAmount * index) / 1e18;
    }
    function EDUToStEDU(uint256 eduAmount) external view returns (uint256) {
        return (eduAmount * 1e18) / index;
    }

    /*//////////////////////////////////////////////////////////////
                               FALLBACKS
    //////////////////////////////////////////////////////////////*/
    receive() external payable {}
}
