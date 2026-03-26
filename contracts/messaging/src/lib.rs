#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Bytes, Env};

#[contracttype]
#[derive(Clone)]
pub struct MessagePayload {
    pub message_id: Bytes,
    pub room_id: Bytes,
    pub sender: Address,
    pub content_hash: Bytes,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Message(Bytes),
}

const XP_PER_MESSAGE: i128 = 10;

#[contract]
pub struct MessagingContract;

#[contractimpl]
impl MessagingContract {
    /// Send a message. Emits `message_sent` event and returns XP awarded.
    pub fn send_message(
        env: Env,
        sender: Address,
        message_id: Bytes,
        room_id: Bytes,
        content_hash: Bytes,
    ) -> i128 {
        sender.require_auth();

        if message_id.is_empty() || room_id.is_empty() || content_hash.is_empty() {
            panic!("invalid args");
        }

        let key = DataKey::Message(message_id.clone());
        if env.storage().persistent().has(&key) {
            panic!("duplicate message_id");
        }

        let ts = env.ledger().timestamp();
        let payload = MessagePayload {
            message_id: message_id.clone(),
            room_id: room_id.clone(),
            sender: sender.clone(),
            content_hash: content_hash.clone(),
            timestamp: ts,
        };
        env.storage().persistent().set(&key, &payload);

        env.events().publish(
            (symbol_short!("msg_sent"), room_id, sender),
            (message_id, content_hash, ts),
        );

        XP_PER_MESSAGE
    }

    /// Delete a message. Only the original sender may delete.
    pub fn delete_message(env: Env, caller: Address, message_id: Bytes) {
        caller.require_auth();

        let key = DataKey::Message(message_id.clone());
        let msg: MessagePayload = env
            .storage()
            .persistent()
            .get(&key)
            .expect("message not found");

        if msg.sender != caller {
            panic!("unauthorized");
        }

        env.storage().persistent().remove(&key);

        env.events()
            .publish((symbol_short!("msg_del"), msg.room_id, caller), message_id);
    }

    /// Fetch a stored message.
    pub fn get_message(env: Env, message_id: Bytes) -> Option<MessagePayload> {
        env.storage()
            .persistent()
            .get(&DataKey::Message(message_id))
    }
}

#[cfg(test)]
mod tests;
