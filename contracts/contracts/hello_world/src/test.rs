use super::*;
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
}
