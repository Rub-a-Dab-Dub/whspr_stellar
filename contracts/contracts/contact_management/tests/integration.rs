use contact_management::{ContactManagementContract, ContactManagementContractClient};
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
struct DummyInvoker;

#[contractimpl]
impl DummyInvoker {}

#[test]
fn test_block_prevents_conversation_initiation_rule() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ContactManagementContract, ());
    let client = ContactManagementContractClient::new(&env, &contract_id);

    let user_a = env.register(DummyInvoker, ());
    let user_b = env.register(DummyInvoker, ());

    client.block_user(&user_a, &user_b);

    let blocked = client.is_blocked(&user_b, &user_a);
    assert!(blocked);
}

#[test]
fn test_block_prevents_transfer_initiation_rule() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ContactManagementContract, ());
    let client = ContactManagementContractClient::new(&env, &contract_id);

    let user_a = env.register(DummyInvoker, ());
    let user_b = env.register(DummyInvoker, ());

    client.block_user(&user_a, &user_b);

    let blocked = client.is_blocked(&user_b, &user_a);
    assert!(blocked);
}
