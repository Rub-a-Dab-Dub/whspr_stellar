#![allow(deprecated)]

use ed25519_dalek::Signer;
use rand::rngs::StdRng;
use rand::SeedableRng;
use soroban_sdk::{
    testutils::Address as _,
    token, Address, Bytes, Env,
};

use crate::{
    build_transfer_message, build_withdraw_message, derive_nullifier, expected_commitment,
    ContractError, PrivatePaymentsContract, PrivatePaymentsContractClient,
};

fn env_setup() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn deploy(env: &Env) -> (Address, PrivatePaymentsContractClient<'_>) {
    let id = env.register_contract(None, PrivatePaymentsContract);
    let client = PrivatePaymentsContractClient::new(env, &id);
    (id, client)
}

fn mint_token(env: &Env, holder: &Address) -> Address {
    let token_id = env
        .register_stellar_asset_contract_v2(holder.clone())
        .address();
    token::StellarAssetClient::new(env, &token_id).mint(holder, &1_000_000_000i128);
    token_id
}

fn signing_key(seed: u64) -> ed25519_dalek::SigningKey {
    let mut rng = StdRng::seed_from_u64(seed);
    ed25519_dalek::SigningKey::generate(&mut rng)
}

fn assemble_proof(
    env: &Env,
    commitment: soroban_sdk::BytesN<32>,
    sk: &ed25519_dalek::SigningKey,
    sig_bytes: &[u8; 64],
) -> Bytes {
    let mut buf = [0u8; 128];
    buf[0..32].copy_from_slice(&commitment.to_array());
    buf[32..64].copy_from_slice(&sk.verifying_key().to_bytes());
    buf[64..128].copy_from_slice(sig_bytes);
    Bytes::from_slice(env, &buf)
}

#[test]
fn deposit_creates_note_and_escrows_tokens() {
    let env = env_setup();
    let (pool, pp) = deploy(&env);
    let owner = Address::generate(&env);
    let token = mint_token(&env, &owner);
    let sk = signing_key(1);
    let pk = soroban_sdk::BytesN::from_array(&env, &sk.verifying_key().to_bytes());
    let commitment = expected_commitment(&env, &pk, &token, 50_000i128, &owner);

    pp.deposit(&owner, &token, &50_000i128, &commitment);

    assert!(pp.get_commitment(&commitment));
    let note = pp.get_note(&commitment);
    assert_eq!(note.amount, 50_000i128);
    assert_eq!(note.owner, owner);
    assert!(!note.is_spent);

    let tc = token::Client::new(&env, &token);
    assert_eq!(tc.balance(&pool), 50_000i128);
}

#[test]
fn withdraw_transfers_out_and_marks_nullifier_spent() {
    let env = env_setup();
    let (pool, pp) = deploy(&env);
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = mint_token(&env, &owner);
    let sk = signing_key(7);
    let pk = soroban_sdk::BytesN::from_array(&env, &sk.verifying_key().to_bytes());
    let amount = 12_000i128;
    let commitment = expected_commitment(&env, &pk, &token, amount, &owner);
    pp.deposit(&owner, &token, &amount, &commitment);

    let nullifier = derive_nullifier(&env, &pk, &commitment);
    let msg = build_withdraw_message(
        &env,
        &nullifier,
        &recipient,
        amount,
        &token,
        &commitment,
    );
    let mut msg_buf = [0u8; 512];
    let ml = msg.len() as usize;
    msg.copy_into_slice(&mut msg_buf[..ml]);
    let sig = sk.sign(&msg_buf[..ml]);
    let proof = assemble_proof(&env, commitment.clone(), &sk, &sig.to_bytes());

    pp.withdraw(&proof, &nullifier, &recipient, &amount);

    assert!(pp.is_spent(&nullifier));
    let tc = token::Client::new(&env, &token);
    assert_eq!(tc.balance(&recipient), amount);
    assert_eq!(tc.balance(&pool), 0i128);
    let note = pp.get_note(&commitment);
    assert!(note.is_spent);
}

#[test]
fn double_withdraw_same_nullifier_fails() {
    let env = env_setup();
    let (_pool, pp) = deploy(&env);
    let owner = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    let token = mint_token(&env, &owner);
    let sk = signing_key(9);
    let pk = soroban_sdk::BytesN::from_array(&env, &sk.verifying_key().to_bytes());
    let amount = 5_000i128;
    let commitment = expected_commitment(&env, &pk, &token, amount, &owner);
    pp.deposit(&owner, &token, &amount, &commitment);

    let nullifier = derive_nullifier(&env, &pk, &commitment);
    let msg = build_withdraw_message(&env, &nullifier, &r1, amount, &token, &commitment);
    let mut msg_buf = [0u8; 512];
    let ml = msg.len() as usize;
    msg.copy_into_slice(&mut msg_buf[..ml]);
    let sig = sk.sign(&msg_buf[..ml]);
    let proof = assemble_proof(&env, commitment.clone(), &sk, &sig.to_bytes());

    pp.withdraw(&proof, &nullifier, &r1, &amount);

    let msg2 = build_withdraw_message(&env, &nullifier, &r2, amount, &token, &commitment);
    let mut msg_buf2 = [0u8; 512];
    let ml2 = msg2.len() as usize;
    msg2.copy_into_slice(&mut msg_buf2[..ml2]);
    let sig2 = sk.sign(&msg_buf2[..ml2]);
    let proof2 = assemble_proof(&env, commitment.clone(), &sk, &sig2.to_bytes());

    let e = pp.try_withdraw(&proof2, &nullifier, &r2, &amount);
    assert_eq!(e.err(), Some(Ok(ContractError::AlreadySpent)));
}

#[test]
fn withdraw_wrong_amount_fails_before_crypto() {
    let env = env_setup();
    let (_pool, pp) = deploy(&env);
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = mint_token(&env, &owner);
    let sk = signing_key(3);
    let pk = soroban_sdk::BytesN::from_array(&env, &sk.verifying_key().to_bytes());
    let amount = 8_000i128;
    let commitment = expected_commitment(&env, &pk, &token, amount, &owner);
    pp.deposit(&owner, &token, &amount, &commitment);

    let nullifier = derive_nullifier(&env, &pk, &commitment);
    let msg = build_withdraw_message(
        &env,
        &nullifier,
        &recipient,
        amount,
        &token,
        &commitment,
    );
    let mut msg_buf = [0u8; 512];
    let ml = msg.len() as usize;
    msg.copy_into_slice(&mut msg_buf[..ml]);
    let sig = sk.sign(&msg_buf[..ml]);
    let proof = assemble_proof(&env, commitment.clone(), &sk, &sig.to_bytes());

    let e = pp.try_withdraw(&proof, &nullifier, &recipient, &(amount - 1));
    assert_eq!(e.err(), Some(Ok(ContractError::AmountMismatch)));
}

#[test]
fn withdraw_bad_signature_traps() {
    let env = env_setup();
    let (_pool, pp) = deploy(&env);
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = mint_token(&env, &owner);
    let sk = signing_key(4);
    let pk = soroban_sdk::BytesN::from_array(&env, &sk.verifying_key().to_bytes());
    let amount = 3_000i128;
    let commitment = expected_commitment(&env, &pk, &token, amount, &owner);
    pp.deposit(&owner, &token, &amount, &commitment);

    let nullifier = derive_nullifier(&env, &pk, &commitment);
    let bad_sig = [7u8; 64];
    let proof = assemble_proof(&env, commitment.clone(), &sk, &bad_sig);

    let e = pp.try_withdraw(&proof, &nullifier, &recipient, &amount);
    assert!(e.is_err());
}

#[test]
fn transfer_private_swaps_commitment_and_spends_nullifier() {
    let env = env_setup();
    let (_pool, pp) = deploy(&env);
    let owner = Address::generate(&env);
    let token = mint_token(&env, &owner);
    let sk = signing_key(11);
    let pk = soroban_sdk::BytesN::from_array(&env, &sk.verifying_key().to_bytes());
    let amount = 20_000i128;
    let c_old = expected_commitment(&env, &pk, &token, amount, &owner);
    pp.deposit(&owner, &token, &amount, &c_old);

    let sk2 = signing_key(12);
    let pk2 = soroban_sdk::BytesN::from_array(&env, &sk2.verifying_key().to_bytes());
    let c_new = expected_commitment(&env, &pk2, &token, amount, &owner);

    let old_nul = derive_nullifier(&env, &pk, &c_old);
    let msg = build_transfer_message(
        &env,
        &old_nul,
        &c_new,
        &token,
        amount,
        &c_old,
        &owner,
    );
    let mut msg_buf = [0u8; 512];
    let ml = msg.len() as usize;
    msg.copy_into_slice(&mut msg_buf[..ml]);
    let sig = sk.sign(&msg_buf[..ml]);
    let proof = assemble_proof(&env, c_old.clone(), &sk, &sig.to_bytes());

    pp.transfer_private(&proof, &old_nul, &c_new);

    assert!(pp.is_spent(&old_nul));
    assert!(pp.get_commitment(&c_new));
    assert!(pp.get_note(&c_old).is_spent);
    assert!(!pp.get_note(&c_new).is_spent);
}

#[test]
fn proof_wrong_length_errors() {
    let env = env_setup();
    let (_pool, pp) = deploy(&env);
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = mint_token(&env, &owner);
    let sk = signing_key(5);
    let pk = soroban_sdk::BytesN::from_array(&env, &sk.verifying_key().to_bytes());
    let amount = 1_000i128;
    let commitment = expected_commitment(&env, &pk, &token, amount, &owner);
    pp.deposit(&owner, &token, &amount, &commitment);

    let short = Bytes::from_slice(&env, &[0u8; 64]);
    let nullifier = derive_nullifier(&env, &pk, &commitment);
    let e = pp.try_withdraw(&short, &nullifier, &recipient, &amount);
    assert_eq!(e.err(), Some(Ok(ContractError::ProofLength)));
}

#[test]
fn duplicate_deposit_commitment_rejected() {
    let env = env_setup();
    let (_pool, pp) = deploy(&env);
    let owner = Address::generate(&env);
    let token = mint_token(&env, &owner);
    let sk = signing_key(6);
    let pk = soroban_sdk::BytesN::from_array(&env, &sk.verifying_key().to_bytes());
    let commitment = expected_commitment(&env, &pk, &token, 100i128, &owner);
    pp.deposit(&owner, &token, &100i128, &commitment);
    let e = pp.try_deposit(&owner, &token, &100i128, &commitment);
    assert_eq!(e.err(), Some(Ok(ContractError::CommitmentAlreadyExists)));
}

#[test]
fn is_spent_false_for_unknown_nullifier() {
    let env = env_setup();
    let (_pool, pp) = deploy(&env);
    let n = soroban_sdk::BytesN::from_array(&env, &[9u8; 32]);
    assert!(!pp.is_spent(&n));
}

#[test]
fn get_commitment_false_for_unknown() {
    let env = env_setup();
    let (_pool, pp) = deploy(&env);
    let c = soroban_sdk::BytesN::from_array(&env, &[8u8; 32]);
    assert!(!pp.get_commitment(&c));
}
