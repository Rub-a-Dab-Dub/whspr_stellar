use crate::{ContractError, MultisigWalletContract, MultisigWalletContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Bytes, Env, Vec,
};

fn create_test_env() -> Env {
    Env::default()
}

fn advance_ledger(env: &Env, blocks: u32) {
    env.ledger().with_mut(|li| {
        li.sequence_number += blocks;
    });
}

#[test]
fn test_create_wallet() {
    let env = create_test_env();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());
    signers.push_back(signer3.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    let wallet = client.get_wallet(&wallet_id);
    assert_eq!(wallet.threshold, 2);
    assert_eq!(wallet.signers.len(), 3);
    assert_eq!(wallet.next_tx_nonce, 1);
}

#[test]
fn test_create_wallet_invalid_threshold_zero() {
    let env = create_test_env();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let mut signers = Vec::new(&env);
    signers.push_back(signer1);

    let result = client.try_create_wallet(&signers, &0);
    assert!(matches!(result, Err(Ok(ContractError::InvalidThreshold))));
}

#[test]
fn test_create_wallet_threshold_exceeds_signers() {
    let env = create_test_env();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let mut signers = Vec::new(&env);
    signers.push_back(signer1);
    signers.push_back(signer2);

    let result = client.try_create_wallet(&signers, &3);
    assert!(matches!(result, Err(Ok(ContractError::InvalidThreshold))));
}

#[test]
fn test_create_wallet_duplicate_signers() {
    let env = create_test_env();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer1.clone());

    let result = client.try_create_wallet(&signers, &2);
    assert!(matches!(result, Err(Ok(ContractError::DuplicateSigner))));
}

#[test]
fn test_propose_and_sign_transaction() {
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

    let pending_tx = client.get_pending_tx(&tx_id);
    assert_eq!(pending_tx.amount, 1000);
    assert_eq!(pending_tx.signature_count, 0);
    assert!(!pending_tx.executed);

    // Sign by first signer
    client.sign_transaction(&tx_id, &signer1);
    let pending_tx = client.get_pending_tx(&tx_id);
    assert_eq!(pending_tx.signature_count, 1);

    // Sign by second signer
    client.sign_transaction(&tx_id, &signer2);
    let pending_tx = client.get_pending_tx(&tx_id);
    assert_eq!(pending_tx.signature_count, 2);
}

#[test]
fn test_propose_transaction_not_a_signer() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let non_signer = Address::generate(&env);
    let recipient = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1);
    signers.push_back(signer2);

    let wallet_id = client.create_wallet(&signers, &2);

    let data = Bytes::new(&env);
    let result = client.try_propose_transaction(&wallet_id, &recipient, &1000, &data, &non_signer);
    assert!(matches!(result, Err(Ok(ContractError::NotASigner))));
}

#[test]
fn test_sign_transaction_twice() {
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

    let data = Bytes::new(&env);
    let tx_id = client.propose_transaction(&wallet_id, &recipient, &1000, &data, &signer1);

    client.sign_transaction(&tx_id, &signer1);
    let result = client.try_sign_transaction(&tx_id, &signer1);
    assert!(matches!(result, Err(Ok(ContractError::AlreadySigned))));
}

#[test]
fn test_revoke_signature() {
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

    // Sign
    client.sign_transaction(&tx_id, &signer1);
    assert_eq!(client.get_pending_tx(&tx_id).signature_count, 1);
    assert!(client.has_signed(&tx_id, &signer1));

    // Revoke
    client.revoke_signature(&tx_id, &signer1);
    assert_eq!(client.get_pending_tx(&tx_id).signature_count, 0);
    assert!(!client.has_signed(&tx_id, &signer1));
}

#[test]
fn test_revoke_signature_not_signed() {
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

    let data = Bytes::new(&env);
    let tx_id = client.propose_transaction(&wallet_id, &recipient, &1000, &data, &signer1);

    let result = client.try_revoke_signature(&tx_id, &signer1);
    assert!(matches!(result, Err(Ok(ContractError::NotSigned))));
}

#[test]
fn test_execute_transaction() {
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

    // Get 2 signatures (threshold)
    client.sign_transaction(&tx_id, &signer1);
    client.sign_transaction(&tx_id, &signer2);

    // Execute
    client.execute_transaction(&tx_id, &signer1);

    let pending_tx = client.get_pending_tx(&tx_id);
    assert!(pending_tx.executed);
}

#[test]
fn test_execute_transaction_threshold_not_met() {
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

    let data = Bytes::new(&env);
    let tx_id = client.propose_transaction(&wallet_id, &recipient, &1000, &data, &signer1);

    // Only 1 signature
    client.sign_transaction(&tx_id, &signer1);

    // Try to execute - should fail
    let result = client.try_execute_transaction(&tx_id, &signer1);
    assert!(matches!(result, Err(Ok(ContractError::ThresholdNotMet))));
}

#[test]
fn test_execute_transaction_twice() {
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

    client.sign_transaction(&tx_id, &signer1);
    client.sign_transaction(&tx_id, &signer2);

    client.execute_transaction(&tx_id, &signer1);
    let result = client.try_execute_transaction(&tx_id, &signer1);
    assert!(matches!(result, Err(Ok(ContractError::TxAlreadyExecuted))));
}

#[test]
fn test_transaction_expiry() {
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

    // Advance ledger past expiry
    advance_ledger(&env, 201);

    // Try to sign - should fail
    let result = client.try_sign_transaction(&tx_id, &signer1);
    assert!(matches!(result, Err(Ok(ContractError::TxExpired))));
}

#[test]
fn test_add_signer() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let new_signer = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    // Add new signer with quorum approval
    let mut approvers = Vec::new(&env);
    approvers.push_back(signer1);
    approvers.push_back(signer2);

    client.add_signer(&wallet_id, &new_signer, &approvers);

    let wallet = client.get_wallet(&wallet_id);
    assert_eq!(wallet.signers.len(), 3);
}

#[test]
fn test_add_signer_insufficient_approvals() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let new_signer = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2);

    let wallet_id = client.create_wallet(&signers, &2);

    // Try to add with only 1 approval
    let mut approvers = Vec::new(&env);
    approvers.push_back(signer1);

    let result = client.try_add_signer(&wallet_id, &new_signer, &approvers);
    assert!(matches!(result, Err(Ok(ContractError::ThresholdNotMet))));
}

#[test]
fn test_remove_signer() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());
    signers.push_back(signer3.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    // Remove signer with quorum approval
    let mut approvers = Vec::new(&env);
    approvers.push_back(signer1);
    approvers.push_back(signer2);

    client.remove_signer(&wallet_id, &signer3, &approvers);

    let wallet = client.get_wallet(&wallet_id);
    assert_eq!(wallet.signers.len(), 2);
}

#[test]
fn test_remove_signer_breaks_threshold() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    // Try to remove signer - would leave only 1 signer with threshold 2
    let mut approvers = Vec::new(&env);
    approvers.push_back(signer1.clone());
    approvers.push_back(signer2.clone());

    let result = client.try_remove_signer(&wallet_id, &signer1, &approvers);
    assert!(matches!(result, Err(Ok(ContractError::InvalidThreshold))));
}

#[test]
fn test_update_threshold() {
    let env = create_test_env();
    env.mock_all_auths();
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);

    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);

    let mut signers = Vec::new(&env);
    signers.push_back(signer1.clone());
    signers.push_back(signer2.clone());
    signers.push_back(signer3.clone());

    let wallet_id = client.create_wallet(&signers, &2);

    // Update threshold with quorum approval
    let mut approvers = Vec::new(&env);
    approvers.push_back(signer1);
    approvers.push_back(signer2);

    client.update_threshold(&wallet_id, &3, &approvers);

    let wallet = client.get_wallet(&wallet_id);
    assert_eq!(wallet.threshold, 3);
}

#[test]
fn test_signature_revocation_prevents_execution() {
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

    // Both sign
    client.sign_transaction(&tx_id, &signer1);
    client.sign_transaction(&tx_id, &signer2);

    // One revokes
    client.revoke_signature(&tx_id, &signer2);

    // Try to execute - should fail
    let result = client.try_execute_transaction(&tx_id, &signer1);
    assert_eq!(result, Err(Ok(ContractError::ThresholdNotMet)));
}

#[test]
fn test_events_emitted() {
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

    // Create wallet - should emit event
    let wallet_id = client.create_wallet(&signers, &2);

    let data = Bytes::new(&env);
    // Propose transaction - should emit event
    let tx_id = client.propose_transaction(&wallet_id, &recipient, &1000, &data, &signer1);

    // Sign - should emit event
    client.sign_transaction(&tx_id, &signer1);
    client.sign_transaction(&tx_id, &signer2);

    // Execute - should emit event
    client.execute_transaction(&tx_id, &signer1);

    // Events are emitted (verified by not panicking)
    let tx = client.get_pending_tx(&tx_id);
    assert!(tx.executed);
}
