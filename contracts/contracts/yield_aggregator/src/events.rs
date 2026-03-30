use soroban_sdk::{symbol_short, Address, Env};

use crate::types::StrategyId;

pub fn emit_deposit(env: &Env, user: &Address, strategy_id: &StrategyId, amount: i128, shares: i128) {
    env.events().publish(
        (symbol_short!("deposit"), user.clone(), strategy_id.clone()),
        (amount, shares),
    );
}

pub fn emit_withdraw(env: &Env, user: &Address, strategy_id: &StrategyId, shares: i128, amount: i128) {
    env.events().publish(
        (symbol_short!("withdraw"), user.clone(), strategy_id.clone()),
        (shares, amount),
    );
}

pub fn emit_harvest(env: &Env, strategy_id: &StrategyId, yield_amount: i128, new_apy_bps: u32) {
    env.events().publish(
        (symbol_short!("harvest"), strategy_id.clone()),
        (yield_amount, new_apy_bps),
    );
}

pub fn emit_rebalance(env: &Env, from: &StrategyId, to: &StrategyId, amount: i128) {
    env.events().publish(
        (symbol_short!("rebalanc"), from.clone(), to.clone()),
        amount,
    );
}
