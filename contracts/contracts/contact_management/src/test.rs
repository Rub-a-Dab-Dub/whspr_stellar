use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::Events,
    Address, Env,
};

#[contract]
struct DummyInvoker;

#[contractimpl]
impl DummyInvoker {}

fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ContactManagementContract, ());

    let user_a = env.register(DummyInvoker, ());
    let user_b = env.register(DummyInvoker, ());
    let user_c = env.register(DummyInvoker, ());

    (env, contract_id, user_a, user_b, user_c)
}

#[test]
fn test_add_and_remove_contact() {
    let (env, contract_id, user_a, user_b, _) = setup();
    let client = ContactManagementContractClient::new(&env, &contract_id);

    client.add_contact(&user_a, &user_b);

    let contacts = client.get_contacts(&user_a);
    assert_eq!(contacts.len(), 1);
    assert_eq!(contacts.get(0).unwrap(), user_b);

    client.remove_contact(&user_a, &user_b);

    let contacts = client.get_contacts(&user_a);
    assert_eq!(contacts.len(), 0);
}

#[test]
fn test_block_is_unilateral_and_hides_contact() {
    let (env, contract_id, user_a, user_b, _) = setup();
    let client = ContactManagementContractClient::new(&env, &contract_id);

    client.add_contact(&user_a, &user_b);
    client.add_contact(&user_b, &user_a);

    client.block_user(&user_a, &user_b);

    let contacts_a = client.get_contacts(&user_a);
    let contacts_b = client.get_contacts(&user_b);

    assert_eq!(contacts_a.len(), 0);
    assert_eq!(contacts_b.len(), 0);

    let blocked = client.is_blocked(&user_a, &user_b);
    assert!(blocked);
}

#[test]
fn test_unblock_user() {
    let (env, contract_id, user_a, user_b, _) = setup();
    let client = ContactManagementContractClient::new(&env, &contract_id);

    client.block_user(&user_a, &user_b);

    let blocked_before = client.is_blocked(&user_a, &user_b);
    assert!(blocked_before);

    client.unblock_user(&user_a, &user_b);

    let blocked_after = client.is_blocked(&user_a, &user_b);
    assert!(!blocked_after);
}

#[test]
fn test_blocked_users_cannot_add_contact() {
    let (env, contract_id, user_a, user_b, _) = setup();
    let client = ContactManagementContractClient::new(&env, &contract_id);

    client.block_user(&user_a, &user_b);

    let res = client.try_add_contact(&user_b, &user_a);
    assert!(matches!(res, Err(Ok(ContractError::BlockedRelationship))));
}

#[test]
fn test_events_emitted_for_state_changes() {
    let (env, contract_id, user_a, user_b, _) = setup();
    let client = ContactManagementContractClient::new(&env, &contract_id);

    let before = env.events().all().len();

    client.add_contact(&user_a, &user_b);
    client.block_user(&user_a, &user_b);
    client.unblock_user(&user_a, &user_b);
    client.add_contact(&user_a, &user_b);
    client.remove_contact(&user_a, &user_b);

    let after = env.events().all().len();
    assert_eq!(after - before, 5);
}

#[test]
fn test_view_functions_private_scope() {
    let (env, contract_id, user_a, user_b, user_c) = setup();
    let client = ContactManagementContractClient::new(&env, &contract_id);

    client.add_contact(&user_a, &user_b);
    client.add_contact(&user_c, &user_b);

    let contacts_a = client.get_contacts(&user_a);
    let contacts_c = client.get_contacts(&user_c);

    assert_eq!(contacts_a.len(), 1);
    assert_eq!(contacts_c.len(), 1);
    assert_eq!(contacts_a.get(0).unwrap(), user_b);
    assert_eq!(contacts_c.get(0).unwrap(), user_b);
}
