#![allow(deprecated)]

use ed25519_dalek::Signer;
use rand::rngs::StdRng;
use rand::SeedableRng;
use private_payments::testkit::{
    assemble_proof, build_withdraw_message, derive_nullifier, expected_commitment,
};
use private_payments::{PrivatePaymentsContract, PrivatePaymentsContractClient};
use soroban_sdk::{
    testutils::Address as _,
    token, Address, Env,
};

fn env_setup() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn mint(env: &Env, holder: &Address) -> Address {
    let id = env
        .register_stellar_asset_contract_v2(holder.clone())
        .address();
    token::StellarAssetClient::new(env, &id).mint(holder, &500_000_000i128);
    id
}

#[test]
fn integration_deposit_withdraw_happy_path() {
    let env = env_setup();
    let pool = env.register_contract(None, PrivatePaymentsContract);
    let pp = PrivatePaymentsContractClient::new(&env, &pool);

    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let tok = mint(&env, &owner);

    let mut rng = StdRng::seed_from_u64(99);
    let sk = ed25519_dalek::SigningKey::generate(&mut rng);
    let pk = soroban_sdk::BytesN::from_array(&env, &sk.verifying_key().to_bytes());
    let amount = 77_777i128;
    let commitment = expected_commitment(&env, &pk, &tok, amount, &owner);

    pp.deposit(&owner, &tok, &amount, &commitment);

    let nullifier = derive_nullifier(&env, &pk, &commitment);
    let msg = build_withdraw_message(
        &env,
        &nullifier,
        &recipient,
        amount,
        &tok,
        &commitment,
    );
    let mut buf = [0u8; 512];
    let n = msg.len() as usize;
    msg.copy_into_slice(&mut buf[..n]);
    let sig = sk.sign(&buf[..n]);
    let proof = assemble_proof(
        &env,
        commitment.clone(),
        &sk.verifying_key().to_bytes(),
        &sig.to_bytes(),
    );

    pp.withdraw(&proof, &nullifier, &recipient, &amount);

    assert!(pp.is_spent(&nullifier));
    let tc = token::Client::new(&env, &tok);
    assert_eq!(tc.balance(&recipient), amount);
}
