use super::*;
use gasless_common::CROSS_CONTRACT_API_VERSION;
use soroban_sdk::{symbol_short, vec, Env};

#[test]
fn test_hello() {
    let env = Env::default();
    let contract_id = env.register(HelloWorldContract, ());
    let client = HelloWorldContractClient::new(&env, &contract_id);

    let words = client.hello(&symbol_short!("Dev"));
    assert_eq!(
        words,
        vec![&env, symbol_short!("Hello"), symbol_short!("Dev")]
    );
    assert_eq!(client.version(), CROSS_CONTRACT_API_VERSION);
}

#[test]
fn test_hello_for_conversation_validation() {
    let env = Env::default();
    let contract_id = env.register(HelloWorldContract, ());
    let client = HelloWorldContractClient::new(&env, &contract_id);

    let words = client.hello_for_conversation(&symbol_short!("Dev"), &7);
    assert_eq!(
        words,
        vec![&env, symbol_short!("Hello"), symbol_short!("Dev")]
    );
}
