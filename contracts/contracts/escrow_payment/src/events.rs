use soroban_sdk::{symbol_short, Address, BytesN, Env};

pub fn emit_escrow_created(env: &Env, escrow_id: &BytesN<32>, sender: &Address, recipient: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("esc_crt"), escrow_id.clone()),
        (sender.clone(), recipient.clone(), amount),
    );
}

pub fn emit_escrow_released(env: &Env, escrow_id: &BytesN<32>, recipient: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("esc_rel"), escrow_id.clone()),
        (recipient.clone(), amount),
    );
}

pub fn emit_escrow_refunded(env: &Env, escrow_id: &BytesN<32>, sender: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("esc_ref"), escrow_id.clone()),
        (sender.clone(), amount),
    );
}

pub fn emit_escrow_disputed(env: &Env, escrow_id: &BytesN<32>) {
    env.events().publish(
        (symbol_short!("esc_dis"), escrow_id.clone()),
        (),
    );
}

pub fn emit_dispute_resolved(env: &Env, escrow_id: &BytesN<32>, recipient_share: i128, sender_share: i128) {
    env.events().publish(
        (symbol_short!("dis_res"), escrow_id.clone()),
        (recipient_share, sender_share),
    );
}
