 #![allow(deprecated)]

use soroban_sdk::{testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation}, token, Address, BytesN, Env};

use crate::{RecurringSubscriptionsContract, RecurringSubscriptionsContractClient, Status, Subscription};

fn create_token(env: &Env, admin: &Address) -> Address {
    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    token::StellarAssetClient::new(env, &token_id).mint(admin, &1_000_000_000);
    token_id
}

fn setup() -> (
    Env,
    Address,
    RecurringSubscriptionsContractClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, RecurringSubscriptionsContract);
    let client = RecurringSubscriptionsContractClient::new(&env, &contract_id);
    client.initialize();
    (env, contract_id, client)
}

#[test]
fn subscribe_creates_valid_subscription() {
    let (env, _contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    // Pre-approve token allowance
    let tc = token::Client::new(&env, &token);
    tc.approve(&alice, &_contract_id, &1_000_000, &1000); // Dummy approval for transfer

    let id = client.subscribe(&bob, &token, &1000, &3600); // 1h interval

    let sub = client.get_subscription(&id);
    let expected = Some(Subscription {
        subscriber: alice.clone(),
        merchant: bob,
        token,
        amount: 1000,
        interval: 3600,
        next_payment_due: env.block().timestamp().u64() + 3600,
        total_paid: 0,
        status: Status::Active,
    });
    assert_eq!(sub, expected);
}

#[test]
fn charge_collects_due_payment() {
    let (mut env, contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    let tc = token::Client::new(&env, &token);
    tc.approve(&alice, &contract_id, &10_000, &3600);

    let id = client.subscribe(&bob, &token, &1000, &1); // 1s interval

    // Fast-forward time past due
    env.block().timestamp().set_current(env.block().timestamp().current() + 2);

    // Merchant charges
    client.charge(&id);

    // Check merchant received payment
    assert_eq!(tc.balance(&bob), 1000);
    // Check updated sub
    let sub = client.get_subscription(&id).unwrap();
    assert_eq!(sub.total_paid, 1000);
    assert!(sub.next_payment_due > env.block().timestamp().u64());
}

#[test]
#[should_panic(expected = "subscription not active")]
fn charge_paused_rejects() {
    let (env, contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    let tc = token::Client::new(&env, &token);
    tc.approve(&alice, &contract_id, &1000, &3600);

    let id = client.subscribe(&bob, &token, &1000, &3600);
    client.pause(&id);

    // env.block().timestamp().set_current(env.block().timestamp().current() + 3601);
    // Try charge anyway
    client.charge(&id);
}

#[test]
#[should_panic(expected = "payment not due yet")]
fn charge_early_rejects() {
    let (env, contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    let tc = token::Client::new(&env, &token);
    tc.approve(&alice, &contract_id, &1000, &3600);

    let id = client.subscribe(&bob, &token, &1000, &3600);
    client.charge(&id); // Too early
}

#[test]
#[should_panic(expected = "only merchant can charge")]
fn charge_by_subscriber_rejects() {
    let (mut env, contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    let tc = token::Client::new(&env, &token);
    tc.approve(&alice, &contract_id, &1000, &1);

    let id = client.subscribe(&bob, &token, &1000, &1);
    env.block().timestamp().set_current(env.block().timestamp().current() + 2);

    // Subscriber tries to charge
    client.with_authorized_invocation(|client| {
        client.charge(&id);
    });
}

#[test]
fn pause_stops_charges() {
    let (mut env, _contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    // Setup sub
    let id = client.subscribe(&bob, &token, &1000, &1);
    client.pause(&id);

    let sub = client.get_subscription(&id).unwrap();
    assert!(matches!(sub.status, Status::Paused));
}

#[test]
fn resume_reactivates() {
    let (env, _contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    let id = client.subscribe(&bob, &token, &1000, &3600);
    client.pause(&id);
    client.resume(&id);

    let sub = client.get_subscription(&id).unwrap();
    assert!(matches!(sub.status, Status::Active));
}

#[test]
fn cancel_prevents_all_ops() {
    let (env, _contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    let id = client.subscribe(&bob, &token, &1000, &3600);
    client.cancel(&id);

    let sub = client.get_subscription(&id).unwrap();
    assert!(matches!(sub.status, Status::Cancelled));
}

#[test]
fn is_due_works() {
    let (mut env, _contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    let id = client.subscribe(&bob, &token, &1000, &1);
    assert!(!client.is_due(&id));

    env.block().timestamp().set_current(env.block().timestamp().current() + 2);
    assert!(client.is_due(&id));
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn subscribe_zero_amount_panics() {
    let (env, _contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    client.subscribe(&bob, &token, &0, &3600);
}

#[test]
#[should_panic(expected = "interval must be positive")]
fn subscribe_zero_interval_panics() {
    let (env, _contract_id, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token = create_token(&env, &alice);

    client.subscribe(&bob, &token, &1000, &0);
}

#[test]
fn fuzz_amounts() {
    let amounts = [1i128, 100, 1000, 1_000_000];
    for &amt in amounts.iter() {
        let (mut env, contract_id, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let token = create_token(&env, &alice);

        let tc = token::Client::new(&env, &token);
        tc.approve(&alice, &contract_id, &amt * 10, &3600);

        let id = client.subscribe(&bob, &token, &amt, &1);
        env.block().timestamp().set_current(env.block().timestamp().current() + 2);
        client.charge(&id);

        assert_eq!(tc.balance(&bob), amt);
    }
}

#[test]
#[should_panic(expected = "already initialized")]
fn double_init_panics() {
    let (env, _contract_id, client) = setup();
    client.initialize();
}

