use gg_pay::interface::{IGGPayDispatcher, IGGPayDispatcherTrait};
use gg_pay::wallet::{IWalletDispatcher, IWalletDispatcherTrait};
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::{ContractAddress, contract_address_const};

// ==================== HELPER FUNCTIONS ====================

fn deploy_gg_pay() -> (ContractAddress, ContractAddress, ContractAddress) {
    let admin = contract_address_const::<0x123>();
    let strk_token = deploy_mock_erc20();
    let platform_fee_bps: u16 = 200; // 2%

    let wallet_classhash = declare("Wallet").unwrap().contract_class();

    let mut calldata = ArrayTrait::new();
    admin.serialize(ref calldata);
    strk_token.serialize(ref calldata);
    platform_fee_bps.serialize(ref calldata);
    wallet_classhash.serialize(ref calldata);

    let contract = declare("GaslessGossipPayments").unwrap().contract_class();

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    (contract_address, admin, strk_token)
}

fn deploy_mock_erc20() -> ContractAddress {
    let contract = declare("MyToken").unwrap().contract_class();

    let name: ByteArray = "Starknet Token";
    let symbol: ByteArray = "STRK";
    let initial_supply: u256 = 1000000000000000000000000; // 1M STRK
    let recipient = contract_address_const::<0x999>();

    let mut constructor_args = array![];
    name.serialize(ref constructor_args);
    symbol.serialize(ref constructor_args);
    initial_supply.serialize(ref constructor_args);
    recipient.serialize(ref constructor_args);

    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    contract_address
}

fn get_alice() -> ContractAddress {
    contract_address_const::<0x111>()
}

fn get_bob() -> ContractAddress {
    contract_address_const::<0x222>()
}

fn get_charlie() -> ContractAddress {
    contract_address_const::<0x333>()
}

fn setup_user_balance(
    strk_token: ContractAddress, user: ContractAddress, amount: u256, spender: ContractAddress,
) {
    let token = IERC20Dispatcher { contract_address: strk_token };
    let holder = contract_address_const::<0x999>();

    // Transfer from holder to user
    start_cheat_caller_address(strk_token, holder);
    token.transfer(user, amount);
    stop_cheat_caller_address(strk_token);

    // User approves spender
    start_cheat_caller_address(strk_token, user);
    token.approve(spender, amount);
    stop_cheat_caller_address(strk_token);
}

// ==================== CONSTRUCTOR TESTS ====================

#[test]
#[should_panic(expected: ('Fee must be <= 1000 (10%)',))]
fn test_cannot_set_fee_above_max() {
    let (contract_address, admin, _) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    start_cheat_caller_address(contract_address, admin);
    gg_pay.set_platform_fee(10000); // Should panic
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_non_admin_cannot_set_fee() {
    let (contract_address, _, _) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();

    start_cheat_caller_address(contract_address, alice);
    gg_pay.set_platform_fee(300); // Should panic
}

#[test]
fn test_pause_unpause() {
    let (contract_address, admin, _) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    // Initially not paused
    assert!(!gg_pay.is_paused(), "Should not be paused");

    // Pause
    start_cheat_caller_address(contract_address, admin);
    gg_pay.set_paused(true);
    assert!(gg_pay.is_paused(), "Should be paused");

    // Unpause
    start_cheat_caller_address(contract_address, admin);
    gg_pay.set_paused(false);
    assert!(!gg_pay.is_paused(), "Should be unpaused");
}

#[test]
#[should_panic(expected: ('Contract is paused',))]
fn test_cannot_tip_when_paused() {
    let (contract_address, admin, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let amount: u256 = 1000000000000000000;

    setup_user_balance(strk_token, alice, amount, contract_address);

    // Pause contract
    start_cheat_caller_address(contract_address, admin);
    gg_pay.set_paused(true);

    // Try to tip (should fail)
    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, amount, 'test'); // Should panic
}

#[test]
#[should_panic(expected: ('Contract is paused',))]
fn test_cannot_pay_room_entry_when_paused() {
    let (contract_address, admin, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let charlie = get_charlie();
    let alice = get_alice();
    let amount: u256 = 10000000000000000000;

    setup_user_balance(strk_token, charlie, amount, contract_address);

    // Pause contract
    start_cheat_caller_address(contract_address, admin);
    gg_pay.set_paused(true);

    // Try to pay room entry (should fail)
    start_cheat_caller_address(contract_address, charlie);
    gg_pay.pay_room_entry(1, alice, amount); // Should panic
}

#[test]
#[should_panic(expected: ('Contract is paused',))]
fn test_cannot_send_tokens_when_paused() {
    let (contract_address, admin, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let amount: u256 = 1000000000000000000;

    setup_user_balance(strk_token, alice, amount, contract_address);

    // Pause contract
    start_cheat_caller_address(contract_address, admin);
    gg_pay.set_paused(true);

    // Try to send tokens (should fail)
    start_cheat_caller_address(contract_address, alice);
    gg_pay.send_tokens(bob, amount); // Should panic
}

// ==================== VIEW FUNCTION TESTS ====================

#[test]
fn test_get_user_balance() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let amount: u256 = 100000000000000000000; // 100 STRK

    setup_user_balance(strk_token, alice, amount, contract_address);

    let balance = gg_pay.get_user_balance(alice);
    assert!(balance == amount, "User balance should match");
}

#[test]
fn test_get_contract_balance() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let amount: u256 = 10000000000000000000;

    // Generate fees (contract accumulates them)
    setup_user_balance(strk_token, alice, amount, contract_address);
    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, amount, 'test');
    stop_cheat_caller_address(contract_address);

    start_cheat_caller_address(contract_address, contract_address);
    let contract_balance = gg_pay.get_balance();
    start_cheat_caller_address(contract_address, contract_address);

    let accumulated_fees = gg_pay.get_accumulated_fees();

    assert!(contract_balance == accumulated_fees, "Contract balance should match fees");
}

// ==================== FEE CALCULATION TESTS ====================

#[test]
fn test_fee_calculation_2_percent() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let amount: u256 = 100000000000000000000; // 100 STRK

    setup_user_balance(strk_token, alice, amount, contract_address);

    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, amount, 'test');

    // 2% of 100 STRK = 2 STRK
    let expected_fee = 2000000000000000000;
    assert!(gg_pay.get_accumulated_fees() == expected_fee, "Fee should be 2 STRK");

    // Bob should receive 98 STRK
    let token = IERC20Dispatcher { contract_address: strk_token };
    let bob_balance = token.balance_of(bob);
    let expected_bob = 98000000000000000000;
    assert!(bob_balance == expected_bob, "Bob should have 98 STRK");
}

#[test]
fn test_fee_calculation_with_updated_fee() {
    let (contract_address, admin, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let amount: u256 = 100000000000000000000; // 100 STRK

    // Update fee to 5%
    start_cheat_caller_address(contract_address, admin);
    gg_pay.set_platform_fee(500);

    setup_user_balance(strk_token, alice, amount, contract_address);

    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, amount, 'test');

    // 5% of 100 STRK = 5 STRK
    let expected_fee = 5000000000000000000;
    assert!(gg_pay.get_accumulated_fees() == expected_fee, "Fee should be 5 STRK");

    // Bob should receive 95 STRK
    let token = IERC20Dispatcher { contract_address: strk_token };
    let bob_balance = token.balance_of(bob);
    let expected_bob = 95000000000000000000;
    assert!(bob_balance == expected_bob, "Bob should have 95 STRK");
}

// ==================== INTEGRATION TESTS ====================

#[test]
fn test_complete_user_flow() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let charlie = get_charlie();

    // Setup balances
    let initial_amount: u256 = 200000000000000000000; // 200 STRK
    setup_user_balance(strk_token, alice, initial_amount, contract_address);
    setup_user_balance(strk_token, bob, initial_amount, contract_address);

    // Alice tips Bob 10 STRK
    let tip_amount: u256 = 10000000000000000000;
    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, tip_amount, 'chat_tip');

    // Bob pays 50 STRK to enter Alice's room
    let room_fee: u256 = 50000000000000000000;
    start_cheat_caller_address(contract_address, bob);
    gg_pay.pay_room_entry(1, alice, room_fee);

    // Alice sends 20 STRK to Charlie (P2P, no fees)
    let p2p_amount: u256 = 20000000000000000000;
    start_cheat_caller_address(contract_address, alice);
    gg_pay.send_tokens(charlie, p2p_amount);

    // Calculate expected fees
    // Tip: 10 STRK × 2% = 0.2 STRK
    // Room: 50 STRK × 2% = 1 STRK
    // P2P: 0 STRK
    // Total: 1.2 STRK
    let expected_total_fees = 1200000000000000000;
    assert!(gg_pay.get_accumulated_fees() == expected_total_fees, "Total fees incorrect");

    // Check final balances
    let token = IERC20Dispatcher { contract_address: strk_token };

    // Charlie should have 20 STRK (from P2P)
    let charlie_balance = token.balance_of(charlie);
    assert!(charlie_balance == p2p_amount, "Charlie balance incorrect");

    // Contract should have accumulated fees
    let contract_balance = gg_pay.get_accumulated_fees();
    assert!(contract_balance == expected_total_fees, "Contract balance incorrect");
}

#[test]
fn test_admin_can_withdraw_partial_fees() {
    let (contract_address, admin, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let amount: u256 = 100000000000000000000; // 100 STRK

    // Generate fees
    setup_user_balance(strk_token, alice, amount, contract_address);
    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, amount, 'test');

    let total_fees = gg_pay.get_accumulated_fees();
    let partial_withdrawal = total_fees / 2;

    // Withdraw half
    let recipient = contract_address_const::<0x777>();
    start_cheat_caller_address(contract_address, admin);
    gg_pay.withdraw_fees(partial_withdrawal, recipient);

    // Check remaining fees
    let remaining_fees = gg_pay.get_accumulated_fees();
    assert!(remaining_fees == total_fees - partial_withdrawal, "Remaining fees incorrect");

    // Withdraw the rest
    start_cheat_caller_address(contract_address, admin);
    gg_pay.withdraw_fees(remaining_fees, recipient);

    assert!(gg_pay.get_accumulated_fees() == 0, "Should have no fees left");
}

#[test]
#[should_panic(expected: ('Insufficient fees',))]
fn test_cannot_withdraw_more_than_accumulated() {
    let (contract_address, admin, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let amount: u256 = 10000000000000000000; // 10 STRK

    // Generate small fees
    setup_user_balance(strk_token, alice, amount, contract_address);
    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, amount, 'test');

    let accumulated_fees = gg_pay.get_accumulated_fees();

    // Try to withdraw more than accumulated
    let recipient = contract_address_const::<0x777>();
    start_cheat_caller_address(contract_address, admin);
    gg_pay.withdraw_fees(accumulated_fees + 1, recipient); // Should panic
}

// ==================== EDGE CASE TESTS ====================

#[test]
fn test_multiple_users_tipping_same_recipient() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let charlie = get_charlie();
    let recipient = contract_address_const::<0x444>();

    let amount: u256 = 5000000000000000000; // 5 STRK

    // Setup balances
    setup_user_balance(strk_token, alice, amount, contract_address);
    setup_user_balance(strk_token, bob, amount, contract_address);
    setup_user_balance(strk_token, charlie, amount, contract_address);

    // All three tip the same recipient
    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(recipient, amount, 'test');

    start_cheat_caller_address(contract_address, bob);
    gg_pay.tip_user(recipient, amount, 'test');

    start_cheat_caller_address(contract_address, charlie);
    gg_pay.tip_user(recipient, amount, 'test');

    // Recipient should receive 3 × (5 STRK × 98%) = 14.7 STRK
    let token = IERC20Dispatcher { contract_address: strk_token };
    let recipient_balance = token.balance_of(recipient);
    let expected_balance = (amount * 98 * 3) / 100;
    assert!(recipient_balance == expected_balance, "Recipient balance incorrect");

    // Total fees: 3 × (5 STRK × 2%) = 0.3 STRK
    let expected_fees = (amount * 2 * 3) / 100;
    assert!(gg_pay.get_accumulated_fees() == expected_fees, "Total fees incorrect");
}

#[test]
fn test_zero_fees_with_free_p2p_transfers() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let charlie = get_charlie();

    let amount: u256 = 10000000000000000000; // 10 STRK

    // Setup balances
    setup_user_balance(strk_token, alice, amount * 2, contract_address);
    setup_user_balance(strk_token, bob, amount, contract_address);

    // Multiple P2P transfers (no fees)
    start_cheat_caller_address(contract_address, alice);
    gg_pay.send_tokens(bob, amount);
    gg_pay.send_tokens(charlie, amount);

    start_cheat_caller_address(contract_address, bob);
    gg_pay.send_tokens(charlie, amount);

    // No fees should be accumulated
    assert!(gg_pay.get_accumulated_fees() == 0, "Should have no fees from P2P");
}

#[test]
fn test_mix_of_all_payment_types() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();

    let amount: u256 = 100000000000000000000; // 100 STRK each

    // Setup balances
    setup_user_balance(strk_token, alice, amount * 3, contract_address);

    // 1. Tip (2% fee)
    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, amount, 'tip');

    let fees_after_tip = gg_pay.get_accumulated_fees();

    // 2. Room entry (2% fee)
    start_cheat_caller_address(contract_address, alice);
    gg_pay.pay_room_entry(1, bob, amount);

    let fees_after_room = gg_pay.get_accumulated_fees();

    // 3. P2P transfer (0% fee)
    start_cheat_caller_address(contract_address, alice);
    gg_pay.send_tokens(bob, amount);

    let fees_after_p2p = gg_pay.get_accumulated_fees();

    // Verify fees only increased from tip and room entry, not P2P
    assert!(fees_after_tip > 0, "Should have fees after tip");
    assert!(fees_after_room > fees_after_tip, "Fees should increase after room");
    assert!(fees_after_p2p == fees_after_room, "P2P should not add fees");

    // Total fees should be: 2 × (100 STRK × 2%) = 4 STRK
    let expected_total = 4000000000000000000;
    assert!(gg_pay.get_accumulated_fees() == expected_total, "Total fees incorrect");
}

#[test]
fn test_constructor_initializes_correctly() {
    let (contract_address, _, _) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    assert!(gg_pay.get_platform_fee() == 200, "Platform fee should be 200 bps");
    assert!(!gg_pay.is_paused(), "Contract should not be paused");
    assert!(gg_pay.get_accumulated_fees() == 0, "Accumulated fees should be 0");
}

// ==================== TIP USER TESTS ====================

#[test]
fn test_tip_user_success() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let amount: u256 = 1000000000000000000; // 1 STRK

    // Setup Alice's balance
    setup_user_balance(strk_token, alice, amount, contract_address);

    // Alice tips Bob
    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, amount, 'chat_tip');

    // Check accumulated fees (2% of 1 STRK = 0.02 STRK)
    let expected_fee = (amount * 200) / 10000; // 20000000000000000
    assert!(gg_pay.get_accumulated_fees() == expected_fee, "Fees incorrect");

    // Check Bob's balance (98% of 1 STRK)
    let token = IERC20Dispatcher { contract_address: strk_token };
    let bob_balance = token.balance_of(bob);
    let expected_bob_balance = amount - expected_fee;
    assert!(bob_balance == expected_bob_balance, "Bob's balance incorrect");
}

#[test]
#[should_panic(expected: ('Cannot tip yourself',))]
fn test_cannot_tip_self() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let amount: u256 = 1000000000000000000;

    setup_user_balance(strk_token, alice, amount, contract_address);

    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(alice, amount, 'test'); // Should panic
}

#[test]
#[should_panic(expected: ('Amount must be positive',))]
fn test_cannot_tip_zero() {
    let (contract_address, _, _) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();

    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, 0, 'test'); // Should panic
}

// ==================== ROOM ENTRY TESTS ====================

#[test]
fn test_pay_room_entry_success() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let charlie = get_charlie(); // User
    let alice = get_alice(); // Room creator
    let room_id: u256 = 123;
    let entry_fee: u256 = 10000000000000000000; // 10 STRK

    // Setup Charlie's balance
    setup_user_balance(strk_token, charlie, entry_fee, contract_address);

    // Charlie pays to enter Alice's room
    start_cheat_caller_address(contract_address, charlie);
    gg_pay.pay_room_entry(room_id, alice, entry_fee);

    // Check platform fees (2% of 10 STRK = 0.2 STRK)
    let expected_fee = (entry_fee * 200) / 10000;
    assert!(gg_pay.get_accumulated_fees() == expected_fee, "Platform fees incorrect");

    // Check Alice's balance (98% of 10 STRK = 9.8 STRK)
    let token = IERC20Dispatcher { contract_address: strk_token };
    let alice_balance = token.balance_of(alice);
    let expected_alice_balance = entry_fee - expected_fee;
    assert!(alice_balance == expected_alice_balance, "Alice's balance incorrect");
}

#[test]
fn test_multiple_room_entries_accumulate_fees() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let charlie = get_charlie();
    let bob = get_bob();
    let alice = get_alice();
    let entry_fee: u256 = 5000000000000000000; // 5 STRK

    // Setup balances
    setup_user_balance(strk_token, charlie, entry_fee * 2, contract_address);
    setup_user_balance(strk_token, bob, entry_fee, contract_address);

    // Charlie enters twice
    start_cheat_caller_address(contract_address, charlie);
    gg_pay.pay_room_entry(1, alice, entry_fee);
    gg_pay.pay_room_entry(2, alice, entry_fee);

    // Bob enters once
    start_cheat_caller_address(contract_address, bob);
    gg_pay.pay_room_entry(3, alice, entry_fee);

    // Total fees: 3 × (5 STRK × 2%) = 0.3 STRK
    let expected_total_fees = (entry_fee * 200 * 3) / 10000;
    assert!(gg_pay.get_accumulated_fees() == expected_total_fees, "Total fees incorrect");
}

// ==================== SEND TOKENS (P2P) TESTS ====================

#[test]
fn test_send_tokens_no_fees() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let amount: u256 = 50000000000000000000; // 50 STRK

    // Setup Alice's balance
    setup_user_balance(strk_token, alice, amount, contract_address);

    // Alice sends to Bob (P2P, no fees)
    start_cheat_caller_address(contract_address, alice);
    gg_pay.send_tokens(bob, amount);

    // Check no fees were charged
    assert!(gg_pay.get_accumulated_fees() == 0, "Should have no fees");

    // Check Bob received full amount
    let token = IERC20Dispatcher { contract_address: strk_token };
    let bob_balance = token.balance_of(bob);
    assert!(bob_balance == amount, "Bob should receive full amount");
}

#[test]
#[should_panic(expected: ('Cannot send to yourself',))]
fn test_cannot_send_to_self() {
    let (contract_address, _, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let amount: u256 = 1000000000000000000;

    setup_user_balance(strk_token, alice, amount, contract_address);

    start_cheat_caller_address(contract_address, alice);
    gg_pay.send_tokens(alice, amount); // Should panic
}

// ==================== ADMIN FUNCTIONS TESTS ====================

#[test]
fn test_withdraw_fees() {
    let (contract_address, admin, strk_token) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let bob = get_bob();
    let amount: u256 = 10000000000000000000; // 10 STRK

    // Generate fees via tip
    setup_user_balance(strk_token, alice, amount, contract_address);
    start_cheat_caller_address(contract_address, alice);
    gg_pay.tip_user(bob, amount, 'test');

    let accumulated_fees = gg_pay.get_accumulated_fees();
    assert!(accumulated_fees > 0, "Should have fees");

    // Admin withdraws fees
    let withdraw_recipient = contract_address_const::<0x777>();
    start_cheat_caller_address(contract_address, admin);
    gg_pay.withdraw_fees(accumulated_fees, withdraw_recipient);

    // Check fees were withdrawn
    assert!(gg_pay.get_accumulated_fees() == 0, "Fees should be 0");

    // Check recipient received fees
    let token = IERC20Dispatcher { contract_address: strk_token };
    let recipient_balance = token.balance_of(withdraw_recipient);
    assert!(recipient_balance == accumulated_fees, "Recipient should have fees");
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_non_admin_cannot_withdraw() {
    let (contract_address, _, _) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    let alice = get_alice();
    let recipient = get_bob();

    start_cheat_caller_address(contract_address, alice);
    gg_pay.withdraw_fees(100, recipient); // Should panic
}

#[test]
fn test_set_platform_fee() {
    let (contract_address, admin, _) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    // Change fee to 3%
    start_cheat_caller_address(contract_address, admin);
    gg_pay.set_platform_fee(300);

    assert!(gg_pay.get_platform_fee() == 300, "Fee should be 300 bps");
}

#[test]
fn test_set_username() {
    let (contract_address, admin, _) = deploy_gg_pay();
    let gg_pay = IGGPayDispatcher { contract_address };

    // Change fee to 3%
    start_cheat_caller_address(contract_address, admin);
    let wallet = gg_pay.create_user('aji');

    assert!(gg_pay.get_user_onchain_address('aji') == wallet, "Username should be 'aji'");
    assert!(gg_pay.get_username_by_wallet(wallet) == 'aji', "Wallet should map to 'aji'");
    gg_pay.update_username('aji', 'ajid');
    assert!(gg_pay.get_user_onchain_address('ajid') == wallet, "Username should be 'ajid'");
    assert!(gg_pay.get_username_by_wallet(wallet) == 'ajid', "Wallet should map to 'ajid'");
}
