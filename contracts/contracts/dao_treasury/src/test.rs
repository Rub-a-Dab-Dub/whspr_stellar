use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    Address, BytesN, Env, Symbol,
};

fn setup() -> (Env, Address, BytesN<32>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(DaoTreasuryContract, ());

    let group_id = BytesN::from_array(&env, &[7u8; 32]);
    (env, contract_id, group_id)
}

#[test]
fn test_deposit_credited_immediately() {
    let (env, contract_id, group_id) = setup();
    let client = DaoTreasuryContractClient::new(&env, &contract_id);

    client.deposit(&group_id, &500);
    assert_eq!(client.get_treasury_balance(&group_id), 500);
}

#[test]
fn test_execute_requires_quorum_and_majority() {
    let (env, contract_id, group_id) = setup();
    let client = DaoTreasuryContractClient::new(&env, &contract_id);
    let recipient = Address::generate(&env);

    client.deposit(&group_id, &1_000);
    let proposal_id = client.create_proposal(&group_id, &recipient, &300, &Symbol::new(&env, "payout"));

    let early_execute = client.try_execute_proposal(&proposal_id);
    assert!(matches!(early_execute, Err(Ok(ContractError::QuorumNotMet))));

    client.vote(&proposal_id, &true);
    let still_quorum_fail = client.try_execute_proposal(&proposal_id);
    assert!(matches!(still_quorum_fail, Err(Ok(ContractError::QuorumNotMet))));

    client.vote(&proposal_id, &false);
    let majority_fail = client.try_execute_proposal(&proposal_id);
    assert!(matches!(majority_fail, Err(Ok(ContractError::MajorityNotMet))));

    client.vote(&proposal_id, &true);
    client.execute_proposal(&proposal_id);

    assert_eq!(client.get_treasury_balance(&group_id), 700);
}

#[test]
fn test_expired_proposal_cannot_be_executed() {
    let (env, contract_id, group_id) = setup();
    let client = DaoTreasuryContractClient::new(&env, &contract_id);
    let recipient = Address::generate(&env);

    client.deposit(&group_id, &1_000);
    let proposal_id = client.create_proposal(&group_id, &recipient, &200, &Symbol::new(&env, "expire"));

    env.ledger().with_mut(|li| {
        li.sequence_number += DEFAULT_PROPOSAL_TTL_LEDGERS + 1;
    });

    let res = client.try_execute_proposal(&proposal_id);
    assert!(matches!(res, Err(Ok(ContractError::ProposalExpired))));
}

#[test]
fn test_treasury_balance_after_operations() {
    let (env, contract_id, group_id) = setup();
    let client = DaoTreasuryContractClient::new(&env, &contract_id);
    let recipient = Address::generate(&env);

    client.deposit(&group_id, &900);
    let proposal_id = client.create_proposal(&group_id, &recipient, &250, &Symbol::new(&env, "fund"));

    client.vote(&proposal_id, &true);
    client.vote(&proposal_id, &true);
    client.execute_proposal(&proposal_id);

    assert_eq!(client.get_treasury_balance(&group_id), 650);
}

#[test]
fn test_full_audit_trail_events_emitted() {
    let (env, contract_id, group_id) = setup();
    let client = DaoTreasuryContractClient::new(&env, &contract_id);
    let recipient = Address::generate(&env);

    let before = env.events().all().len();

    client.deposit(&group_id, &1_000);
    let proposal_id = client.create_proposal(&group_id, &recipient, &100, &Symbol::new(&env, "audit"));
    client.vote(&proposal_id, &true);
    client.vote(&proposal_id, &true);
    client.execute_proposal(&proposal_id);

    let after = env.events().all().len();
    assert_eq!(after - before, 5);
}
