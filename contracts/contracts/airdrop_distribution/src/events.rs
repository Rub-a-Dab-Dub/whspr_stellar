use soroban_sdk::{symbol_short, Address, BytesN, Env};

pub fn emit_campaign_created(env: &Env, campaign_id: &BytesN<32>, token: &Address, total_amount: i128) {
    env.events().publish(
        (symbol_short!("camp_crt"), campaign_id.clone()),
        (token.clone(), total_amount),
    );
}

pub fn emit_claimed(env: &Env, campaign_id: &BytesN<32>, claimer: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("claimed"), campaign_id.clone()),
        (claimer.clone(), amount),
    );
}

pub fn emit_campaign_cancelled(env: &Env, campaign_id: &BytesN<32>, returned: i128) {
    env.events().publish(
        (symbol_short!("camp_cnl"), campaign_id.clone()),
        returned,
    );
}
