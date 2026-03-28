use soroban_sdk::{symbol_short, Address, BytesN, Env, Symbol};

pub fn emit_conversation_created(
    env: &Env,
    conversation_id: &BytesN<32>,
    participant_a: &Address,
    participant_b: &Address,
    created_at: u64,
) {
    let topics = (symbol_short!("conv_new"), conversation_id.clone());
    env.events().publish(
        topics,
        (participant_a.clone(), participant_b.clone(), created_at),
    );
}

pub fn emit_message_sent(
    env: &Env,
    message_id: &BytesN<32>,
    conversation_id: &BytesN<32>,
    sender: &Address,
    timestamp: u64,
) {
    let topics = (symbol_short!("msg_sent"), conversation_id.clone());
    env.events()
        .publish(topics, (message_id.clone(), sender.clone(), timestamp));
}

pub fn emit_message_delivered(env: &Env, message_id: &BytesN<32>, conversation_id: &BytesN<32>) {
    let topics = (symbol_short!("msg_dlvd"), conversation_id.clone());
    env.events().publish(topics, message_id.clone());
}

pub fn emit_message_read(
    env: &Env,
    message_id: &BytesN<32>,
    conversation_id: &BytesN<32>,
    reader: &Address,
) {
    let topics = (symbol_short!("msg_read"), conversation_id.clone());
    env.events()
        .publish(topics, (message_id.clone(), reader.clone()));
}

pub fn emit_message_deleted(
    env: &Env,
    message_id: &BytesN<32>,
    conversation_id: &BytesN<32>,
    deleted_by: &Address,
) {
    let topics = (symbol_short!("msg_del"), conversation_id.clone());
    env.events()
        .publish(topics, (message_id.clone(), deleted_by.clone()));
}

pub fn emit_conversation_expired(env: &Env, conversation_id: &BytesN<32>) {
    let topics = (Symbol::new(env, "conv_expired"), conversation_id.clone());
    env.events().publish(topics, ());
}
