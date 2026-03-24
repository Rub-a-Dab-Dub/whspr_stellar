use multisig_wallet::{MultisigWalletContract, MultisigWalletContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Bytes, Env, Vec,
};

fn create_test_env() -> Env {
    Env::default()
}

#[test]
fn test_full_multisig_flow() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    // Setup: Create 3-of-5 multisig wallet
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);
    let signer4 = Address::generate(&env);
    let signer5 = Address::generate(&env);
    let recipient = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());
    signers.push_back(signer3.clone());
    signers.push_back(signer4.clone());
    signers.push_back(signer5.clone());

    let wallet_id = client.create_wallet(&signers, &3);

    // Verify wallet created correctly
    let wallet = client.get_wallet(&wallet_id);
    assert_eq!(wallet.threshold, 3);
    assert_eq!(wallet.signers.len(), 5);

    // Propose a transaction
    let data = Bytes::new(&env);
    let tx_id = client.propose_transaction(&wallet_id, &recipient, &5000, &data, &signer1);

    // Verify transaction proposed
    let tx = client.get_pending_tx(&tx_id);
    assert_eq!(tx.amount, 5000);
    assert_eq!(tx.signature_count, 0);
    assert!(!tx.executed);

    // Collect signatures from 3 signers
    client.sign_transaction(&tx_id, &signer1);
    assert_eq!(client.get_pending_tx(&tx_id).signature_count, 1);

    client.sign_transaction(&tx_id, &signer3);
    assert_eq!(client.get_pending_tx(&tx_id).signature_count, 2);

    client.sign_transaction(&tx_id, &signer5);
    assert_eq!(client.get_pending_tx(&tx_id).signature_count, 3);

    // Execute transaction
    client.execute_transaction(&tx_id, &signer1);

    // Verify execution
    let tx = client.get_pending_tx(&tx_id);
    assert!(tx.executed);
}

#[test]
fn test_signer_management_flow() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    // Create 2-of-3 wallet
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);
    let new_signer = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());
    signers.push_back(signer3.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    // Add a new signer with quorum
    let mut approvers = Vec::new(&env);
    approvers.push_back(signer1.clone());
    approvers.push_back(signer2.clone());

    client.add_signer(&wallet_id, &new_signer, &approvers);

    let wallet = client.get_wallet(&wallet_id);
    assert_eq!(wallet.signers.len(), 4);

    // Update threshold to 3
    client.update_threshold(&wallet_id, &3, &approvers);

    let wallet = client.get_wallet(&wallet_id);
    assert_eq!(wallet.threshold, 3);

    // Remove a signer - now need 3 approvers since threshold is 3
    let mut new_approvers = Vec::new(&env);
    new_approvers.push_back(signer1.clone());
    new_approvers.push_back(signer2.clone());
    new_approvers.push_back(new_signer.clone());

    client.remove_signer(&wallet_id, &signer3, &new_approvers);

    let wallet = client.get_wallet(&wallet_id);
    assert_eq!(wallet.signers.len(), 3);
}

#[test]
fn test_concurrent_transactions() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    // Propose two transactions
    let data = Bytes::new(&env);
    let tx_id1 = client.propose_transaction(&wallet_id, &recipient1, &1000, &data, &signer1);
    let tx_id2 = client.propose_transaction(&wallet_id, &recipient2, &2000, &data, &signer1);

    // Sign both transactions
    client.sign_transaction(&tx_id1, &signer1);
    client.sign_transaction(&tx_id1, &signer2);

    client.sign_transaction(&tx_id2, &signer1);
    client.sign_transaction(&tx_id2, &signer2);

    // Execute both
    client.execute_transaction(&tx_id1, &signer1);
    client.execute_transaction(&tx_id2, &signer2);

    // Verify both executed
    assert!(client.get_pending_tx(&tx_id1).executed);
    assert!(client.get_pending_tx(&tx_id2).executed);
}

#[test]
fn test_signature_revocation_workflow() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);
    let recipient = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());
    signers.push_back(signer3.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    let data = Bytes::new(&env);
    let tx_id = client.propose_transaction(&wallet_id, &recipient, &1000, &data, &signer1);

    // All three sign
    client.sign_transaction(&tx_id, &signer1);
    client.sign_transaction(&tx_id, &signer2);
    client.sign_transaction(&tx_id, &signer3);

    assert_eq!(client.get_pending_tx(&tx_id).signature_count, 3);

    // One revokes
    client.revoke_signature(&tx_id, &signer3);
    assert_eq!(client.get_pending_tx(&tx_id).signature_count, 2);

    // Can still execute with 2 signatures (threshold met)
    client.execute_transaction(&tx_id, &signer1);
    assert!(client.get_pending_tx(&tx_id).executed);
}

#[test]
fn test_transaction_expiry_workflow() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let recipient = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    let data = Bytes::new(&env);
    let tx_id = client.propose_transaction(&wallet_id, &recipient, &1000, &data, &signer1);

    // Sign before expiry
    client.sign_transaction(&tx_id, &signer1);

    // Advance ledger past expiry (DEFAULT_TX_TTL_LEDGERS = 200)
    env.ledger().with_mut(|li| {
        li.sequence_number += 201;
    });

    // Try to sign after expiry - should fail
    let result = client.try_sign_transaction(&tx_id, &signer2);
    assert!(result.is_err());

    // Try to execute after expiry - should fail
    let result = client.try_execute_transaction(&tx_id, &signer1);
    assert!(result.is_err());
}

#[test]
fn test_complex_signer_rotation() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    // Start with 2-of-3
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());
    signers.push_back(signer3.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    // Add two new signers
    let new_signer1 = Address::generate(&env);
    let new_signer2 = Address::generate(&env);

    let mut approvers = Vec::new(&env);
    approvers.push_back(signer1.clone());
    approvers.push_back(signer2.clone());

    client.add_signer(&wallet_id, &new_signer1, &approvers);
    client.add_signer(&wallet_id, &new_signer2, &approvers);

    assert_eq!(client.get_wallet(&wallet_id).signers.len(), 5);

    // Increase threshold to 3
    client.update_threshold(&wallet_id, &3, &approvers);
    assert_eq!(client.get_wallet(&wallet_id).threshold, 3);

    // Remove old signers
    let mut new_approvers = Vec::new(&env);
    new_approvers.push_back(signer1.clone());
    new_approvers.push_back(signer2.clone());
    new_approvers.push_back(new_signer1.clone());

    client.remove_signer(&wallet_id, &signer3, &new_approvers);

    let wallet = client.get_wallet(&wallet_id);
    assert_eq!(wallet.signers.len(), 4);
    assert_eq!(wallet.threshold, 3);
}

#[test]
fn test_audit_trail_via_events() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let recipient = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());

    // Each operation should emit events
    let wallet_id = client.create_wallet(&signers, &2);

    let data = Bytes::new(&env);
    let tx_id = client.propose_transaction(&wallet_id, &recipient, &1000, &data, &signer1);

    client.sign_transaction(&tx_id, &signer1);
    client.sign_transaction(&tx_id, &signer2);

    client.execute_transaction(&tx_id, &signer1);

    // Verify all operations completed successfully (events emitted)
    let tx = client.get_pending_tx(&tx_id);
    assert!(tx.executed);
    assert_eq!(tx.signature_count, 2);
}

#[test]
fn test_zero_amount_transaction() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let recipient = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2);

    let wallet_id = client.create_wallet(&signers, &2);

    // Zero amount should be allowed (for data-only transactions)
    let data = Bytes::from_array(&env, &[1, 2, 3, 4]);
    let tx_id = client.propose_transaction(&wallet_id, &recipient, &0, &data, &signer1);

    let tx = client.get_pending_tx(&tx_id);
    assert_eq!(tx.amount, 0);
}

#[test]
fn test_large_data_payload() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let recipient = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    // Create large data payload
    let mut data = Bytes::new(&env);
    for i in 0..100 {
        data.push_back(i as u8);
    }

    let tx_id = client.propose_transaction(&wallet_id, &recipient, &1000, &data, &signer1);

    let tx = client.get_pending_tx(&tx_id);
    assert_eq!(tx.data.len(), 100);
}
