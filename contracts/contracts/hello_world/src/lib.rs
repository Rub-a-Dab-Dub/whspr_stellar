#![no_std]

use gasless_common::types::ConversationId;
use gasless_common::{CommonError, CROSS_CONTRACT_API_VERSION};
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloWorldContract;

#[contractimpl]
impl HelloWorldContract {
    pub fn version(_env: Env) -> u32 {
        CROSS_CONTRACT_API_VERSION
    }

    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }

    pub fn hello_for_conversation(
        env: Env,
        to: Symbol,
        conversation_id: u64,
    ) -> Result<Vec<Symbol>, CommonError> {
        let _ = ConversationId::new(conversation_id)?;
        Ok(vec![&env, symbol_short!("Hello"), to])
    }
}

#[cfg(test)]
mod test;
