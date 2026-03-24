#![allow(deprecated)]
/// Full scenario: register (XP init) → create room → join room → send message → tip → P2P transfer
///
/// Validates that all four contracts interact correctly in a realistic user flow.
use soroban_sdk::{symbol_short, testutils::Address as _, token, Address, Bytes, Env};

use messaging::{MessagingContract, MessagingContractClient};
use payments::{PaymentsContract, PaymentsContractClient};
use rooms::{RoomsContract, RoomsContractClient};
use xp::{XpContract, XpContractClient};

fn b(env: &Env, s: &str) -> Bytes {
    Bytes::from_slice(env, s.as_bytes())
}

fn mint_token(env: &Env, admin: &Address, amount: i128) -> Address {
    let token_id = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    token::StellarAssetClient::new(env, &token_id).mint(admin, &amount);
    token_id
}

#[test]
fn scenario_register_chat_transfer_xp() {
    let env = Env::default();
    env.mock_all_auths();

    // ── Deploy contracts ──────────────────────────────────────────────────
    let platform = Address::generate(&env);
    let admin = Address::generate(&env); // XP admin (backend paymaster)

    let msg_id = env.register_contract(None, MessagingContract);
    let pay_id = env.register_contract(None, PaymentsContract);
    let room_id_contract = env.register_contract(None, RoomsContract);
    let xp_id = env.register_contract(None, XpContract);

    let msg_client = MessagingContractClient::new(&env, &msg_id);
    let pay_client = PaymentsContractClient::new(&env, &pay_id);
    let room_client = RoomsContractClient::new(&env, &room_id_contract);
    let xp_client = XpContractClient::new(&env, &xp_id);

    pay_client.initialize(&platform);
    room_client.initialize(&platform);
    xp_client.initialize(&admin);

    // ── Users ─────────────────────────────────────────────────────────────
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = mint_token(&env, &alice, 10_000_000);

    // ── Step 1: Alice creates a room (+50 XP) ────────────────────────────
    let room = b(&env, "room_general");
    let xp_earned = room_client.create_room(&alice, &room, &0, &None, &None);
    assert_eq!(xp_earned, 50);
    xp_client.award_xp(&alice, &xp_earned, &symbol_short!("room_crt"));
    assert_eq!(xp_client.get_xp(&alice), 50);

    // ── Step 2: Bob joins the room ────────────────────────────────────────
    room_client.join_room(&bob, &room);
    assert!(room_client.is_member(&room, &bob));

    // ── Step 3: Alice sends a message (+10 XP) ───────────────────────────
    let xp_msg =
        msg_client.send_message(&alice, &b(&env, "msg1"), &room, &b(&env, "ipfs://QmHash"));
    assert_eq!(xp_msg, 10);
    xp_client.award_xp(&alice, &xp_msg, &symbol_short!("message"));
    assert_eq!(xp_client.get_xp(&alice), 60);

    // ── Step 4: Bob tips Alice 1000 tokens (+20 XP to Bob) ───────────────
    // Give bob some tokens first
    token::StellarAssetClient::new(&env, &token).mint(&bob, &5_000_000);
    let xp_tip = pay_client.tip(&bob, &alice, &token, &1000, &room);
    assert_eq!(xp_tip, 20);
    xp_client.award_xp(&bob, &xp_tip, &symbol_short!("tip"));

    let tc = token::Client::new(&env, &token);
    // Alice: started with 10M, received 980 net from Bob's tip, sent 500 P2P (done later)
    // At this point (after tip, before transfer): 10M + 980
    assert_eq!(tc.balance(&alice), 10_000_980);
    assert_eq!(tc.balance(&platform), 20); // 2% fee

    // ── Step 5: Alice does a P2P transfer to Bob (no fee) ────────────────
    pay_client.transfer(&alice, &bob, &token, &500);
    assert_eq!(tc.balance(&alice), 10_000_480); // 10M + 980 - 500
    assert_eq!(tc.balance(&bob), 5_000_000 - 1000 + 500); // paid tip + received transfer

    // ── Step 6: Verify XP state ───────────────────────────────────────────
    assert_eq!(xp_client.get_xp(&alice), 60); // 50 + 10
    assert_eq!(xp_client.get_xp(&bob), 20); // tip XP
    assert_eq!(xp_client.get_level(&alice), 0); // < 1000 XP
    assert_eq!(xp_client.get_level(&bob), 0);
}

#[test]
fn scenario_level_up_after_many_messages() {
    let env = Env::default();
    env.mock_all_auths();

    let xp_id = env.register_contract(None, XpContract);
    let msg_id = env.register_contract(None, MessagingContract);
    let xp_client = XpContractClient::new(&env, &xp_id);
    let msg_client = MessagingContractClient::new(&env, &msg_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    xp_client.initialize(&admin);

    // Send 100 messages → 1000 XP → level up
    for i in 0u32..100 {
        let msg_id_bytes = Bytes::from_slice(&env, format!("msg{i}").as_bytes());
        let xp = msg_client.send_message(
            &alice,
            &msg_id_bytes,
            &Bytes::from_slice(&env, b"room"),
            &Bytes::from_slice(&env, b"hash"),
        );
        xp_client.award_xp(&alice, &xp, &symbol_short!("message"));
    }

    assert_eq!(xp_client.get_xp(&alice), 1000);
    assert_eq!(xp_client.get_level(&alice), 1);
}
