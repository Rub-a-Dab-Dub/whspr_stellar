use dao_treasury::DaoTreasuryContract;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, Symbol,
};

#[test]
fn test_full_dao_flow_integration() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(DaoTreasuryContract, ());
    let client = dao_treasury::DaoTreasuryContractClient::new(&env, &contract_id);

    let group_id = BytesN::from_array(&env, &[11u8; 32]);
    let recipient = Address::generate(&env);

    client.deposit(&group_id, &2_000);
    assert_eq!(client.get_treasury_balance(&group_id), 2_000);

    let proposal_id = client.create_proposal(&group_id, &recipient, &600, &Symbol::new(&env, "ops"));

    client.vote(&proposal_id, &true);
    client.vote(&proposal_id, &true);
    client.execute_proposal(&proposal_id);

    assert_eq!(client.get_treasury_balance(&group_id), 1_400);
}

#[test]
fn test_expiry_blocks_execution_integration() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(DaoTreasuryContract, ());
    let client = dao_treasury::DaoTreasuryContractClient::new(&env, &contract_id);

    let group_id = BytesN::from_array(&env, &[12u8; 32]);
    let recipient = Address::generate(&env);

    client.deposit(&group_id, &500);
    let proposal_id = client.create_proposal(&group_id, &recipient, &100, &Symbol::new(&env, "exp"));

    env.ledger().with_mut(|li| {
        li.sequence_number += 101;
    });

    let res = client.try_execute_proposal(&proposal_id);
    assert!(matches!(res, Err(Ok(dao_treasury::ContractError::ProposalExpired))));
}
