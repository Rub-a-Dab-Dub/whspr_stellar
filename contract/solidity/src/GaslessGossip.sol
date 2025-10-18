// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "lib/openzeppelin-contracts/contracts/utils/Pausable.sol";

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IWallet {
    function withdrawETH(address payable recipient, uint256 amount) external returns (bool);
    function getBalance() external view returns (uint256);
    function getERC20Balance(address token) external view returns (uint256);
    function withdrawERC20(address token, address recipient, uint256 amount) external returns (bool);
}

/// @title GaslessGossip - Gasless tipping & payments with user tag wallets
contract GaslessGossip is ReentrancyGuard, Ownable, Pausable {
    uint16 public platformFeeBps; // Fee for all paid actions (200 = 2%)
    uint256 public accumulatedFees;
    address public paymasterAddress;

    mapping(string => bool) public isUserRegistered;
    mapping(string => UserProfile) public userProfiles;
    mapping(address => string) public walletToUsername;
    mapping(address => uint256) public accumulatedTokenFees;

    struct UserProfile {
        string username;
        address userWallet;
        bool exists;
    }

    // ==================== EVENTS ====================
    event TipSent(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 platformFee,
        uint256 netAmount,
        string context,
        uint256 timestamp
    );
    event RoomEntryPaid(
        address indexed user,
        uint256 roomId,
        address indexed roomCreator,
        uint256 entryFee,
        uint256 platformFee,
        uint256 creatorAmount,
        uint256 timestamp
    );
    event TokensSent(address indexed sender, address indexed recipient, uint256 amount, uint256 timestamp);
    event FeesWithdrawn(address indexed recipient, uint256 amount, uint256 timestamp);
    event PlatformFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps, uint256 timestamp);
    event PauseStatusChanged(bool paused, uint256 timestamp);
    event UserRegistered(string indexed username, address indexed walletAddress);
    event UsernameUpdated(string oldUsername, string newUsername, address indexed walletAddress);
    event UserWithdrawal(
        address indexed userWallet, address indexed recipient, address token, uint256 amount, uint256 timestamp
    );

    // ==================== ERRORS ====================
    error ZeroAddress();
    error SelfTip();
    error SelfSend();
    error ZeroAmount();
    error ContractPaused();
    error InvalidFee();
    error InsufficientFees();
    error UsernameTaken();
    error UsernameNotExist();
    error OnlyPaymaster();
    error SameUsername();
    error InsufficientWalletBalance();
    error AmountMismatch();
    error UnexpectedETH();
    error EmptyUsername();

    constructor(address _admin, uint16 _platformFeeBps) Ownable(_admin) {
        if (_admin == address(0)) revert ZeroAddress();
        if (_platformFeeBps > 1000) revert InvalidFee(); // Max 10%
        platformFeeBps = _platformFeeBps;
        paymasterAddress = _admin;
    }

    // ==================== EXTERNAL FUNCTIONS ====================

    function tipUser(address recipient, uint256 amount, address token, string memory context)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (msg.sender == recipient) revert SelfTip();
        if (amount == 0) revert ZeroAmount();

        uint256 feeBps = platformFeeBps;
        uint256 platformFee = (amount * feeBps) / 10000;
        uint256 netAmount = amount - platformFee;

        if (token == address(0)) {
            // Native ETH tip
            if (msg.value != amount) revert AmountMismatch();
            accumulatedFees += platformFee;
            payable(recipient).transfer(netAmount);
        } else {
            // ERC20 tip
            if (msg.value != 0) revert UnexpectedETH();
            IERC20(token).transferFrom(msg.sender, address(this), amount);
            IERC20(token).transfer(recipient, netAmount);
            accumulatedTokenFees[token] += platformFee;
        }

        emit TipSent(msg.sender, recipient, amount, platformFee, netAmount, context, block.timestamp);
    }

    /// @notice Pay room entry fee (2% platform fee, 98% to creator)
    function payRoomEntry(uint256 roomId, address roomCreator, uint256 entryFee, address token)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (roomCreator == address(0)) revert ZeroAddress();
        if (entryFee == 0) revert ZeroAmount();

        uint256 feeBps = platformFeeBps;
        uint256 platformFee = (entryFee * feeBps) / 10000;
        uint256 creatorAmount = entryFee - platformFee;

        if (token == address(0)) {
            // Native ETH payment
            if (msg.value != entryFee) revert AmountMismatch();
            accumulatedFees += platformFee;
            payable(roomCreator).transfer(creatorAmount);
        } else {
            // ERC20 payment
            if (msg.value != 0) revert UnexpectedETH();
            IERC20(token).transferFrom(msg.sender, address(this), entryFee);
            IERC20(token).transfer(roomCreator, creatorAmount);
            accumulatedTokenFees[token] += platformFee;
        }

        emit RoomEntryPaid(msg.sender, roomId, roomCreator, entryFee, platformFee, creatorAmount, block.timestamp);
    }

    /// @notice Send tokens directly (NO FEES)
    function sendTokens(address recipient, uint256 amount, address token) external payable nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        if (msg.sender == recipient) revert SelfSend();
        if (amount == 0) revert ZeroAmount();

        if (token == address(0)) {
            // Native ETH send
            if (msg.value != amount) revert AmountMismatch();
            payable(recipient).transfer(amount);
        } else {
            // ERC20 send
            if (msg.value != 0) revert UnexpectedETH();
            IERC20(token).transferFrom(msg.sender, recipient, amount);
        }

        emit TokensSent(msg.sender, recipient, amount, block.timestamp);
    }

    /// @notice Owner withdraws accumulated ETH platform fees
    function withdrawETHFees(address payable recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > accumulatedFees) revert InsufficientFees();

        accumulatedFees -= amount;
        (bool success,) = recipient.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit FeesWithdrawn(recipient, amount, block.timestamp);
    }

    /// @notice Owner withdraws accumulated token platform fees
    function withdrawTokenFees(address token, address recipient, uint256 amount) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > accumulatedTokenFees[token]) revert InsufficientFees();

        accumulatedTokenFees[token] -= amount;
        IERC20(token).transfer(recipient, amount);

        emit FeesWithdrawn(recipient, amount, block.timestamp);
    }

    /// @notice Owner sets platform fee (max 10%)
    function setPlatformFee(uint16 feeBps) external onlyOwner {
        if (feeBps > 1000) revert InvalidFee();

        uint16 oldFee = platformFeeBps;
        platformFeeBps = feeBps;

        emit PlatformFeeUpdated(oldFee, feeBps, block.timestamp);
    }

    /// @notice Owner pauses the contract
    function pause() external onlyOwner {
        _pause();
        emit PauseStatusChanged(true, block.timestamp);
    }

    /// @notice Owner unpauses the contract
    function unpause() external onlyOwner {
        _unpause();
        emit PauseStatusChanged(false, block.timestamp);
    }

    /// @notice Paymaster creates user with tag wallet
    function createUser(string calldata username) external whenNotPaused returns (address) {
        if (msg.sender != paymasterAddress) revert OnlyPaymaster();
        if (bytes(username).length == 0) revert EmptyUsername();
        if (isUserRegistered[username]) revert UsernameTaken();

        address walletAddress = address(new Wallet(address(this)));
        userProfiles[username] = UserProfile({username: username, userWallet: walletAddress, exists: true});
        isUserRegistered[username] = true;
        walletToUsername[walletAddress] = username;

        emit UserRegistered(username, walletAddress);
        return walletAddress;
    }

    /// @notice Paymaster updates username
    function updateUsername(string calldata oldUsername, string calldata newUsername) external whenNotPaused {
        if (msg.sender != paymasterAddress) revert OnlyPaymaster();
        if (bytes(oldUsername).length == 0 || bytes(newUsername).length == 0) revert EmptyUsername();

        UserProfile memory oldUser = userProfiles[oldUsername];
        if (!oldUser.exists) revert UsernameNotExist();

        if (isUserRegistered[newUsername]) revert UsernameTaken();
        if (keccak256(bytes(oldUsername)) == keccak256(bytes(newUsername))) revert SameUsername();

        // Update mappings
        isUserRegistered[oldUsername] = false;
        isUserRegistered[newUsername] = true;

        userProfiles[newUsername] = UserProfile({username: newUsername, userWallet: oldUser.userWallet, exists: true});
        walletToUsername[oldUser.userWallet] = newUsername;

        // Mark old as inactive
        userProfiles[oldUsername].exists = false;

        emit UsernameUpdated(oldUsername, newUsername, oldUser.userWallet);
    }

    /// @notice Paymaster withdraws from user wallet
    function withdrawFromUserWallet(address token, string calldata username, address recipient, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        returns (bool)
    {
        if (msg.sender != paymasterAddress) revert OnlyPaymaster();
        if (bytes(username).length == 0) revert EmptyUsername();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        UserProfile memory user = userProfiles[username];
        if (!user.exists) revert UsernameNotExist();

        IWallet wallet = IWallet(user.userWallet);

        if (token == address(0)) {
            // Native ETH withdrawal
            uint256 balance = user.userWallet.balance;
            if (balance < amount) revert InsufficientWalletBalance();
            bool success = wallet.withdrawETH(payable(recipient), amount);
            emit UserWithdrawal(user.userWallet, recipient, token, amount, block.timestamp);
            return success;
        } else {
            // ERC20 withdrawal
            uint256 balance = IERC20(token).balanceOf(user.userWallet);
            if (balance < amount) revert InsufficientWalletBalance();
            bool success = wallet.withdrawERC20(token, recipient, amount);
            emit UserWithdrawal(user.userWallet, recipient, token, amount, block.timestamp);
            return success;
        }
    }

    // ==================== VIEW FUNCTIONS ====================

    function getPlatformFee() external view returns (uint16) {
        return platformFeeBps;
    }

    function getAccumulatedFees() external view returns (uint256) {
        return accumulatedFees;
    }

    function getAccumulatedTokenFees(address token) external view returns (uint256) {
        return accumulatedTokenFees[token];
    }

    function getUserOnchainAddress(string calldata username) external view returns (address) {
        UserProfile memory user = userProfiles[username];
        if (!user.exists) revert UsernameNotExist();
        return user.userWallet;
    }

    function getUsernameByWallet(address wallet) external view returns (string memory) {
        string memory username = walletToUsername[wallet];
        if (bytes(username).length == 0) revert UsernameNotExist();
        return username;
    }

    function getUserWalletBalance(string memory username, address token) external view returns (uint256) {
        address wallet = userProfiles[username].userWallet;
        if (token == address(0)) {
            return wallet.balance; // Native ETH
        } else {
            return IERC20(token).balanceOf(wallet); // ERC20 token
        }
    }

    // ==================== INTERNAL ====================
    function _assertNotPaused() internal view {
        if (paused()) revert ContractPaused();
    }
}

/// @title Wallet - Minimal smart wallet controlled by GaslessGossip
contract Wallet {
    address public immutable router;

    constructor(address _router) {
        require(_router != address(0), "Invalid router");
        router = _router;
    }

    modifier onlyRouter() {
        require(msg.sender == router, "Not authorized");
        _;
    }

    function withdrawERC20(address token, address recipient, uint256 amount) external onlyRouter returns (bool) {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");

        IERC20 erc20 = IERC20(token);
        uint256 balance = erc20.balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");

        bool success = erc20.transfer(recipient, amount);
        require(success, "Transfer failed");
        return true;
    }

    function withdrawETH(address payable recipient, uint256 amount) external onlyRouter returns (bool) {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        uint256 balance = address(this).balance;
        require(balance >= amount, "Insufficient balance");

        (bool success,) = recipient.call{value: amount}("");
        require(success, "ETH transfer failed");
        return true;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getERC20Balance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    receive() external payable {}
}
