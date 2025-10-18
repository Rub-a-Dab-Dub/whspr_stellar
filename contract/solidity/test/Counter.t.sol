// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {GaslessGossip} from "../src/GaslessGossip.sol";
import {MockERC20} from "../src/MockUsdc.sol";

contract GaslessGossipTest is Test {
    GaslessGossip public payments;
    MockERC20 public mockToken;

    address admin = makeAddr("admin");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");
    address recipient = makeAddr("recipient");
    address roomCreator = makeAddr("roomCreator");

    string public constant USERNAME1 = "alice";
    string public constant USERNAME2 = "bob";

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
    event UserWithdrawal(address indexed userWallet, address indexed recipient, address token, uint256 amount, uint256 timestamp);

    uint16 public constant DEFAULT_FEE_BPS = 200; // 2%

    function setUp() public {
        mockToken = new MockERC20(admin);

        payments = new GaslessGossip(admin, DEFAULT_FEE_BPS);

        // Fund users with ETH
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(admin, 10 ether);

        // Mint tokens to users
        vm.prank(admin);
        mockToken.mint(user1, 10000 ether);
        vm.prank(admin);
        mockToken.mint(user2, 10000 ether);

        // Create users (admin is paymaster)
        vm.prank(admin);
        payments.createUser(USERNAME1);
        vm.prank(admin);
        payments.createUser(USERNAME2);
    }

    /* ---------------------------- USER REGISTRATION ---------------------------- */

    function test_createUser() public {
        string memory newUser = "charlie";

        vm.expectEmit(false, false, false, false);
        emit UserRegistered(newUser, address(0));

        vm.prank(admin);
        address userWallet = payments.createUser(newUser);
        address expectedWallet = payments.getUserOnchainAddress(newUser);

        assertEq(userWallet, expectedWallet);
        assertTrue(payments.isUserRegistered(newUser));
    }

    function test_createUserTwiceReverts() public {
        string memory newUser = "dupTag";  // Fresh username, not in setUp
        vm.prank(admin);
        payments.createUser(newUser);

        vm.expectRevert();
        vm.prank(admin);
        payments.createUser(newUser);
    }

    function test_createUserEmptyUsernameReverts() public {
        vm.expectRevert();
        vm.prank(admin);
        payments.createUser("");
    }

    function test_createUserNonPaymasterReverts() public {
        string memory newUser = "unauth";
        vm.expectRevert();
        vm.prank(user1);
        payments.createUser(newUser);
    }

    /* ---------------------------- USERNAME UPDATE ---------------------------- */

    function test_updateUsername() public {
        string memory newUser = "alice_new";

        vm.expectEmit(false, false, false, false);
        emit UsernameUpdated(USERNAME1, newUser, payments.getUserOnchainAddress(USERNAME1));

        vm.prank(admin);
        payments.updateUsername(USERNAME1, newUser);

        assertFalse(payments.isUserRegistered(USERNAME1));
        assertTrue(payments.isUserRegistered(newUser));
        assertEq(payments.getUsernameByWallet(payments.getUserOnchainAddress(newUser)), newUser);
        ( , , bool exists) = payments.userProfiles(USERNAME1);
        assertFalse(exists);
    }

    function test_updateUsernameSameNameReverts() public {
        vm.expectRevert();
        vm.prank(admin);
        payments.updateUsername(USERNAME1, USERNAME1);
    }

    function test_updateUsernameNewNameTakenReverts() public {
        string memory newUser = USERNAME2;
        vm.expectRevert();
        vm.prank(admin);
        payments.updateUsername(USERNAME1, newUser);
    }

    function test_updateUsernameOldNameNotExistReverts() public {
        vm.expectRevert();
        vm.prank(admin);
        payments.updateUsername("ghost", "newghost");
    }

    function test_updateUsernameNonPaymasterReverts() public {
        string memory newUser = "unauth_update";
        vm.expectRevert();
        vm.prank(user1);
        payments.updateUsername(USERNAME1, newUser);
    }

    /* ---------------------------- TIP USER ---------------------------- */

    function test_tipUserETH() public {
        uint256 tipAmount = 1 ether;
        uint256 expectedFee = (tipAmount * DEFAULT_FEE_BPS) / 10000;
        uint256 expectedNet = tipAmount - expectedFee;

        vm.expectEmit(false, false, false, false);
        emit TipSent(user1, recipient, tipAmount, expectedFee, expectedNet, "tip", block.timestamp);

        vm.prank(user1);
        payments.tipUser{value: tipAmount}(recipient, tipAmount, address(0), "tip");

        assertEq(payments.accumulatedFees(), expectedFee);
        assertEq(recipient.balance, expectedNet);
    }

    function test_tipUserERC20() public {
        uint256 tipAmount = 100 ether;
        uint256 expectedFee = (tipAmount * DEFAULT_FEE_BPS) / 10000;
        uint256 expectedNet = tipAmount - expectedFee;

        vm.prank(user1);
        mockToken.approve(address(payments), tipAmount);

        vm.expectEmit(false, false, false, false);
        emit TipSent(user1, recipient, tipAmount, expectedFee, expectedNet, "tip", block.timestamp);

        vm.prank(user1);
        payments.tipUser(recipient, tipAmount, address(mockToken), "tip");

        assertEq(payments.accumulatedTokenFees(address(mockToken)), expectedFee);
        assertEq(mockToken.balanceOf(recipient), expectedNet);
    }

    function test_tipUserSelfTipReverts() public {
        uint256 tipAmount = 1 ether;
        vm.prank(user1);
        vm.expectRevert();
        payments.tipUser{value: tipAmount}(user1, tipAmount, address(0), "");
    }

    function test_tipUserZeroAmountReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        payments.tipUser(recipient, 0, address(0), "");
    }

    function test_tipUserAmountMismatchReverts() public {
        uint256 tipAmount = 1 ether;
        vm.prank(user1);
        vm.expectRevert();
        payments.tipUser{value: 0.5 ether}(recipient, tipAmount, address(0), "");
    }

    function test_tipUserUnexpectedETHReverts() public {
        uint256 tipAmount = 100 ether;
        vm.prank(user1);
        mockToken.approve(address(payments), tipAmount);
        vm.prank(user1);
        vm.expectRevert();
        payments.tipUser{value: 0.1 ether}(recipient, tipAmount, address(mockToken), "");
    }

    /* ---------------------------- PAY ROOM ENTRY ---------------------------- */

    function test_payRoomEntryETH() public {
        uint256 roomId = 1;
        uint256 entryFee = 0.5 ether;
        uint256 expectedFee = (entryFee * DEFAULT_FEE_BPS) / 10000;
        uint256 expectedCreatorAmount = entryFee - expectedFee;

        vm.expectEmit(false, false, false, false);
        emit RoomEntryPaid(user1, roomId, roomCreator, entryFee, expectedFee, expectedCreatorAmount, block.timestamp);

        vm.prank(user1);
        payments.payRoomEntry{value: entryFee}(roomId, roomCreator, entryFee, address(0));

        assertEq(payments.accumulatedFees(), expectedFee);
        assertEq(roomCreator.balance, expectedCreatorAmount);
    }

    function test_payRoomEntryERC20() public {
        uint256 roomId = 1;
        uint256 entryFee = 50 ether;
        uint256 expectedFee = (entryFee * DEFAULT_FEE_BPS) / 10000;
        uint256 expectedCreatorAmount = entryFee - expectedFee;

        vm.prank(user1);
        mockToken.approve(address(payments), entryFee);

        vm.expectEmit(false, false, false, false);
        emit RoomEntryPaid(user1, roomId, roomCreator, entryFee, expectedFee, expectedCreatorAmount, block.timestamp);

        vm.prank(user1);
        payments.payRoomEntry(roomId, roomCreator, entryFee, address(mockToken));

        assertEq(payments.accumulatedTokenFees(address(mockToken)), expectedFee);
        assertEq(mockToken.balanceOf(roomCreator), expectedCreatorAmount);
    }

    function test_payRoomEntryZeroCreatorReverts() public {
        uint256 roomId = 1;
        uint256 entryFee = 0.1 ether;
        vm.prank(user1);
        vm.expectRevert();
        payments.payRoomEntry{value: entryFee}(roomId, address(0), entryFee, address(0));
    }

    function test_payRoomEntryZeroAmountReverts() public {
        uint256 roomId = 1;
        vm.prank(user1);
        vm.expectRevert();
        payments.payRoomEntry(roomId, roomCreator, 0, address(0));
    }

    /* ---------------------------- SEND TOKENS ---------------------------- */

    function test_sendTokensETH() public {
        uint256 sendAmount = 0.2 ether;

        vm.expectEmit(false, false, false, false);
        emit TokensSent(user1, recipient, sendAmount, block.timestamp);

        vm.prank(user1);
        payments.sendTokens{value: sendAmount}(recipient, sendAmount, address(0));

        assertEq(recipient.balance, sendAmount);
    }

    function test_sendTokensERC20() public {
        uint256 sendAmount = 10 ether;

        vm.prank(user1);
        mockToken.approve(address(payments), sendAmount);

        vm.expectEmit(false, false, false, false);
        emit TokensSent(user1, recipient, sendAmount, block.timestamp);

        vm.prank(user1);
        payments.sendTokens(recipient, sendAmount, address(mockToken));

        assertEq(mockToken.balanceOf(recipient), sendAmount);
    }

    function test_sendTokensSelfSendReverts() public {
        uint256 sendAmount = 0.1 ether;
        vm.prank(user1);
        vm.expectRevert();
        payments.sendTokens{value: sendAmount}(user1, sendAmount, address(0));
    }

    function test_sendTokensZeroAmountReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        payments.sendTokens(recipient, 0, address(0));
    }

    /* ---------------------------- WITHDRAW FROM USER WALLET ---------------------------- */

    function test_withdrawFromUserWalletETH() public {
        address userWallet = payments.getUserOnchainAddress(USERNAME1);
        vm.deal(userWallet, 1 ether);

        uint256 withdrawAmount = 0.3 ether;
        address withdrawTo = makeAddr("withdrawTo");

        vm.expectEmit(false, false, false, false);
        emit UserWithdrawal(userWallet, withdrawTo, address(0), withdrawAmount, block.timestamp);

        vm.prank(admin);
        bool success = payments.withdrawFromUserWallet(address(0), USERNAME1, withdrawTo, withdrawAmount);

        assertTrue(success);
        assertEq(withdrawTo.balance, withdrawAmount);
        assertEq(userWallet.balance, 0.7 ether);
    }

    function test_withdrawFromUserWalletERC20() public {
        address userWallet = payments.getUserOnchainAddress(USERNAME1);
        uint256 depositAmount = 20 ether;
        uint256 withdrawAmount = 5 ether;
        address withdrawTo = makeAddr("withdrawTo");

        vm.prank(user1);
        mockToken.transfer(userWallet, depositAmount);

        vm.expectEmit(false, false, false, false);
        emit UserWithdrawal(userWallet, withdrawTo, address(mockToken), withdrawAmount, block.timestamp);

        vm.prank(admin);
        bool success = payments.withdrawFromUserWallet(address(mockToken), USERNAME1, withdrawTo, withdrawAmount);

        assertTrue(success);
        assertEq(mockToken.balanceOf(withdrawTo), withdrawAmount);
        assertEq(mockToken.balanceOf(userWallet), depositAmount - withdrawAmount);
    }

    function test_withdrawFromUserWalletInsufficientBalanceReverts() public {
        uint256 withdrawAmount = 1 ether;
        address withdrawTo = makeAddr("withdrawTo");

        vm.prank(admin);
        vm.expectRevert();
        payments.withdrawFromUserWallet(address(0), USERNAME1, withdrawTo, withdrawAmount);
    }

    function test_withdrawFromUserWalletEmptyUsernameReverts() public {
        address withdrawTo = makeAddr("withdrawTo");
        uint256 withdrawAmount = 0.1 ether;

        vm.prank(admin);
        vm.expectRevert();
        payments.withdrawFromUserWallet(address(0), "", withdrawTo, withdrawAmount);
    }

    function test_withdrawFromUserWalletNonPaymasterReverts() public {
        address userWallet = payments.getUserOnchainAddress(USERNAME1);
        vm.deal(userWallet, 0.5 ether);
        address withdrawTo = makeAddr("withdrawTo");
        uint256 withdrawAmount = 0.1 ether;

        vm.prank(user1);
        vm.expectRevert();
        payments.withdrawFromUserWallet(address(0), USERNAME1, withdrawTo, withdrawAmount);
    }

    function test_withdrawFromUserWalletZeroAmountReverts() public {
        address withdrawTo = makeAddr("withdrawTo");

        vm.prank(admin);
        vm.expectRevert();
        payments.withdrawFromUserWallet(address(0), USERNAME1, withdrawTo, 0);
    }

    /* ---------------------------- FEE WITHDRAWAL ---------------------------- */

    function test_withdrawETHFees() public {
        uint256 tipAmount = 1 ether;
        uint256 expectedFee = (tipAmount * DEFAULT_FEE_BPS) / 10000;

        vm.prank(user1);
        payments.tipUser{value: tipAmount}(recipient, tipAmount, address(0), "");

        vm.expectEmit(false, false, false, false);
        emit FeesWithdrawn(admin, expectedFee, block.timestamp);

        vm.prank(admin);
        payments.withdrawETHFees(payable(admin), expectedFee);

        assertEq(payments.accumulatedFees(), 0);
        assertEq(admin.balance, 10 ether + expectedFee);
    }

    function test_withdrawTokenFees() public {
        uint256 tipAmount = 100 ether;
        uint256 expectedFee = (tipAmount * DEFAULT_FEE_BPS) / 10000;

        vm.prank(user1);
        mockToken.approve(address(payments), tipAmount);
        vm.prank(user1);
        payments.tipUser(recipient, tipAmount, address(mockToken), "");

        vm.prank(admin);
        payments.withdrawTokenFees(address(mockToken), admin, expectedFee);

        assertEq(payments.accumulatedTokenFees(address(mockToken)), 0);
        assertEq(mockToken.balanceOf(admin), expectedFee);
    }

    function test_withdrawETHFeesInsufficientReverts() public {
        vm.prank(admin);
        vm.expectRevert();
        payments.withdrawETHFees(payable(admin), 1 ether);
    }

    function test_withdrawTokenFeesZeroTokenReverts() public {
        vm.prank(admin);
        vm.expectRevert();
        payments.withdrawTokenFees(address(0), admin, 100);
    }

    function test_withdrawETHFeesZeroAmountReverts() public {
        vm.prank(admin);
        vm.expectRevert();
        payments.withdrawETHFees(payable(admin), 0);
    }

    function test_withdrawETHFeesNonOwnerReverts() public {
        vm.deal(address(payments), 1 ether);
        vm.prank(user1);
        vm.expectRevert();
        payments.withdrawETHFees(payable(user1), 0.1 ether);
    }

    /* ---------------------------- PLATFORM FEE UPDATE ---------------------------- */

    function test_setPlatformFee() public {
        uint16 newFee = 100; // 1%

        vm.expectEmit(false, false, false, false);
        emit PlatformFeeUpdated(DEFAULT_FEE_BPS, newFee, block.timestamp);

        vm.prank(admin);
        payments.setPlatformFee(newFee);

        assertEq(payments.platformFeeBps(), newFee);
    }

    function test_setPlatformFeeInvalidReverts() public {
        vm.prank(admin);
        vm.expectRevert();
        payments.setPlatformFee(1001); // >10%
    }

    function test_setPlatformFeeNonOwnerReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        payments.setPlatformFee(100);
    }

    /* ---------------------------- PAUSE/UNPAUSE ---------------------------- */

    function test_pauseAndUnpause() public {
        vm.prank(admin);
        payments.pause();

        assertTrue(payments.paused());

        vm.expectEmit(false, false, false, false);
        emit PauseStatusChanged(false, block.timestamp);

        vm.prank(admin);
        payments.unpause();

        assertFalse(payments.paused());
    }

    function test_pauseNonOwnerReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        payments.pause();
    }

    function test_pausedRevertsActions() public {
        vm.prank(admin);
        payments.pause();

        uint256 tipAmount = 0.1 ether;
        vm.prank(user1);
        vm.expectRevert();
        payments.tipUser{value: tipAmount}(recipient, tipAmount, address(0), "");

        vm.prank(admin);
        vm.expectRevert();
        payments.createUser("newuser");
    }

    /* ---------------------------- VIEW FUNCTIONS ---------------------------- */

    function test_getUserOnchainAddress() public {
        address wallet = payments.getUserOnchainAddress(USERNAME1);
        assertNotEq(wallet, address(0));
    }

    function test_getUserOnchainAddressNotExistReverts() public {
        vm.expectRevert();
        payments.getUserOnchainAddress("ghost");
    }

    function test_getUsernameByWallet() public {
        address wallet = payments.getUserOnchainAddress(USERNAME1);
        string memory username = payments.getUsernameByWallet(wallet);
        assertEq(username, USERNAME1);
    }

    function test_getUsernameByWalletInvalidReverts() public {
        vm.expectRevert();
        payments.getUsernameByWallet(makeAddr("invalid"));
    }

    function test_getUserWalletBalanceETH() public {
        address userWallet = payments.getUserOnchainAddress(USERNAME1);
        vm.deal(userWallet, 2 ether);

        uint256 balance = payments.getUserWalletBalance(USERNAME1, address(0));
        assertEq(balance, 2 ether);
    }

    function test_getUserWalletBalanceERC20() public {
        address userWallet = payments.getUserOnchainAddress(USERNAME1);
        uint256 deposit = 15 ether;
        vm.prank(user1);
        mockToken.transfer(userWallet, deposit);

        uint256 balance = payments.getUserWalletBalance(USERNAME1, address(mockToken));
        assertEq(balance, deposit);
    }

    function test_getPlatformFee() public {
        assertEq(payments.getPlatformFee(), DEFAULT_FEE_BPS);
    }

    function test_getAccumulatedFees() public {
        assertEq(payments.getAccumulatedFees(), 0);
    }

    /* ---------------------------- EDGE CASES ---------------------------- */

    function test_tipUserZeroAddressReverts() public {
        uint256 tipAmount = 1 ether;
        vm.prank(user1);
        vm.expectRevert();
        payments.tipUser{value: tipAmount}(address(0), tipAmount, address(0), "");
    }

    function test_sendTokensZeroAddressReverts() public {
        uint256 sendAmount = 0.1 ether;
        vm.prank(user1);
        vm.expectRevert();
        payments.sendTokens{value: sendAmount}(address(0), sendAmount, address(0));
    }
}