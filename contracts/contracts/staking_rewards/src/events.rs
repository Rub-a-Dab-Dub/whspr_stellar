use soroban_sdk::{symbol_short, Address, BytesN, Env};

pub fn emit_staked(env: &Env, stake_id: &BytesN<32>, staker: &Address, amount: i128, lock_until: u64) {
    env.events().publish(
        (symbol_short!("staked"), stake_id.clone()),
        (staker.clone(), amount, lock_until),
    );
}

pub fn emit_unstaked(env: &Env, stake_id: &BytesN<32>, staker: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("unstaked"), stake_id.clone()),
        (staker.clone(), amount),
    );
}

pub fn emit_reward_claimed(env: &Env, stake_id: &BytesN<32>, staker: &Address, reward: i128) {
    env.events().publish(
        (symbol_short!("rew_clm"), stake_id.clone()),
        (staker.clone(), reward),
    );
}
