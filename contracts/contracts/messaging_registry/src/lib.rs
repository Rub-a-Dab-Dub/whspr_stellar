#![no_std]

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use errors::MessagingError;
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Vec};
use storage::DataKey;
use types::{
    ConversationRecord, MessageRecord, CONVERSATION_TTL_LEDGERS, MAX_MESSAGES_PER_CONVERSATION,
    MESSAGE_TTL_LEDGERS,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Returns a canonical sorted pair so (A,B) and (B,A) map to the same key.
fn sorted_pair(a: Address, b: Address) -> (Address, Address) {
    // Compare by their raw bytes representation to get a stable ordering.
    // Soroban Address implements PartialOrd so we can compare directly.
    if a < b {
        (a, b)
    } else {
        (b, a)
    }
}

/// Derive a deterministic 32-byte conversation ID from the two participants
/// and the creation timestamp.
fn derive_conversation_id(env: &Env, a: &Address, b: &Address, ts: u64) -> BytesN<32> {
    let mut buf = soroban_sdk::Bytes::new(env);
    buf.append(&soroban_sdk::Bytes::from_slice(env, &ts.to_be_bytes()));
    // XDR-encode addresses into bytes via their string form – stable and unique
    let a_bytes = a.to_string();
    let b_bytes = b.to_string();
    buf.append(&soroban_sdk::Bytes::from_slice(env, a_bytes.as_bytes()));
    buf.append(&soroban_sdk::Bytes::from_slice(env, b_bytes.as_bytes()));
    env.crypto().sha256(&buf)
}

/// Derive a deterministic 32-byte message ID.
fn derive_message_id(
    env: &Env,
    conversation_id: &BytesN<32>,
    sender: &Address,
    message_hash: &BytesN<32>,
    timestamp: u64,
) -> BytesN<32> {
    let mut buf = soroban_sdk::Bytes::new(env);
    buf.append(&soroban_sdk::Bytes::from_array(
        env,
        conversation_id.as_array(),
    ));
    buf.append(&soroban_sdk::Bytes::from_array(
        env,
        message_hash.as_array(),
    ));
    buf.append(&soroban_sdk::Bytes::from_slice(
        env,
        &timestamp.to_be_bytes(),
    ));
    let sender_str = sender.to_string();
    buf.append(&soroban_sdk::Bytes::from_slice(env, sender_str.as_bytes()));
    env.crypto().sha256(&buf)
}

fn assert_participant(
    env: &Env,
    conv: &ConversationRecord,
    caller: &Address,
) -> Result<(), MessagingError> {
    if &conv.participant_a != caller && &conv.participant_b != caller {
        return Err(MessagingError::Unauthorized);
    }
    Ok(())
}

fn assert_not_expired(env: &Env, conv: &ConversationRecord) -> Result<(), MessagingError> {
    let now = env.ledger().timestamp();
    if now > conv.expires_at {
        return Err(MessagingError::ConversationExpired);
    }
    Ok(())
}

fn load_conversation(env: &Env, id: &BytesN<32>) -> Result<ConversationRecord, MessagingError> {
    env.storage()
        .persistent()
        .get(&DataKey::Conversation(id.clone()))
        .ok_or(MessagingError::ConversationNotFound)
}

fn save_conversation(env: &Env, conv: &ConversationRecord) {
    env.storage()
        .persistent()
        .set(&DataKey::Conversation(conv.id.clone()), conv);
    env.storage().persistent().extend_ttl(
        &DataKey::Conversation(conv.id.clone()),
        CONVERSATION_TTL_LEDGERS,
        CONVERSATION_TTL_LEDGERS,
    );
}

fn load_message(env: &Env, id: &BytesN<32>) -> Result<MessageRecord, MessagingError> {
    env.storage()
        .persistent()
        .get(&DataKey::Message(id.clone()))
        .ok_or(MessagingError::MessageNotFound)
}

fn save_message(env: &Env, msg: &MessageRecord) {
    env.storage()
        .persistent()
        .set(&DataKey::Message(msg.id.clone()), msg);
    env.storage().persistent().extend_ttl(
        &DataKey::Message(msg.id.clone()),
        MESSAGE_TTL_LEDGERS,
        MESSAGE_TTL_LEDGERS,
    );
}

fn append_message_to_conversation(env: &Env, conversation_id: &BytesN<32>, message_id: BytesN<32>) {
    let key = DataKey::ConversationMessages(conversation_id.clone());
    let mut list: Vec<BytesN<32>> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env));
    list.push_back(message_id);
    env.storage().persistent().set(&key, &list);
    env.storage()
        .persistent()
        .extend_ttl(&key, CONVERSATION_TTL_LEDGERS, CONVERSATION_TTL_LEDGERS);
}

// ─── Contract ───────────────────────────────────────────────────────────────

#[contract]
pub struct MessagingRegistryContract;

#[contractimpl]
impl MessagingRegistryContract {
    // ── Initialisation ──────────────────────────────────────────────────────

    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    // ── Conversation Management ─────────────────────────────────────────────

    /// Create a new conversation between the caller (participant_a) and
    /// `participant_b`.  Returns the 32-byte conversation ID.
    pub fn create_conversation(
        env: Env,
        participant_a: Address,
        participant_b: Address,
    ) -> Result<BytesN<32>, MessagingError> {
        participant_a.require_auth();

        let (sorted_a, sorted_b) = sorted_pair(participant_a.clone(), participant_b.clone());

        // Prevent duplicate conversations between the same two addresses.
        let dup_key = DataKey::ParticipantConversation(sorted_a.clone(), sorted_b.clone());
        if env.storage().persistent().has(&dup_key) {
            return Err(MessagingError::ConversationAlreadyExists);
        }

        let now = env.ledger().timestamp();
        let expires_at = now + (CONVERSATION_TTL_LEDGERS as u64 * 5); // rough seconds estimate

        let conversation_id = derive_conversation_id(&env, &sorted_a, &sorted_b, now);

        let record = ConversationRecord {
            id: conversation_id.clone(),
            participant_a: sorted_a.clone(),
            participant_b: sorted_b.clone(),
            created_at: now,
            expires_at,
            message_count: 0,
            is_active: true,
        };

        save_conversation(&env, &record);

        // Store the deduplication lookup
        env.storage().persistent().set(&dup_key, &conversation_id);
        env.storage().persistent().extend_ttl(
            &dup_key,
            CONVERSATION_TTL_LEDGERS,
            CONVERSATION_TTL_LEDGERS,
        );

        // Initialise empty message list
        let list_key = DataKey::ConversationMessages(conversation_id.clone());
        env.storage()
            .persistent()
            .set(&list_key, &Vec::<BytesN<32>>::new(&env));
        env.storage().persistent().extend_ttl(
            &list_key,
            CONVERSATION_TTL_LEDGERS,
            CONVERSATION_TTL_LEDGERS,
        );

        events::emit_conversation_created(&env, &conversation_id, &sorted_a, &sorted_b, now);

        Ok(conversation_id)
    }

    /// Look up the conversation ID for two participants (order-independent).
    pub fn get_conversation_id(
        env: Env,
        participant_a: Address,
        participant_b: Address,
    ) -> Result<BytesN<32>, MessagingError> {
        let (sorted_a, sorted_b) = sorted_pair(participant_a, participant_b);
        env.storage()
            .persistent()
            .get(&DataKey::ParticipantConversation(sorted_a, sorted_b))
            .ok_or(MessagingError::ConversationNotFound)
    }

    /// Fetch full conversation metadata. Only participants may call this.
    pub fn get_conversation(
        env: Env,
        caller: Address,
        conversation_id: BytesN<32>,
    ) -> Result<ConversationRecord, MessagingError> {
        caller.require_auth();
        let conv = load_conversation(&env, &conversation_id)?;
        assert_participant(&env, &conv, &caller)?;
        Ok(conv)
    }

    // ── Messaging ───────────────────────────────────────────────────────────

    /// Record a new message.  The actual content lives off-chain; only the
    /// SHA-256 hash is stored here.  Returns the message ID.
    pub fn send_message(
        env: Env,
        sender: Address,
        conversation_id: BytesN<32>,
        message_hash: BytesN<32>,
        timestamp: u64,
    ) -> Result<BytesN<32>, MessagingError> {
        sender.require_auth();

        // Basic timestamp sanity — must not be in the far future.
        let now = env.ledger().timestamp();
        if timestamp > now + 300 {
            return Err(MessagingError::InvalidTimestamp);
        }

        let mut conv = load_conversation(&env, &conversation_id)?;
        assert_participant(&env, &conv, &sender)?;
        assert_not_expired(&env, &conv)?;

        if conv.message_count >= MAX_MESSAGES_PER_CONVERSATION {
            return Err(MessagingError::TooManyMessages);
        }

        let message_id =
            derive_message_id(&env, &conversation_id, &sender, &message_hash, timestamp);

        let record = MessageRecord {
            id: message_id.clone(),
            conversation_id: conversation_id.clone(),
            sender: sender.clone(),
            message_hash,
            timestamp,
            is_delivered: false,
            is_read: false,
            is_deleted: false,
        };

        save_message(&env, &record);
        append_message_to_conversation(&env, &conversation_id, message_id.clone());

        conv.message_count += 1;
        save_conversation(&env, &conv);

        events::emit_message_sent(&env, &message_id, &conversation_id, &sender, timestamp);

        Ok(message_id)
    }

    /// Return all message records for a conversation.  Caller must be a
    /// participant.  Deleted messages are included with `is_deleted = true`
    /// so the tombstone history is preserved.
    pub fn get_conversation_messages(
        env: Env,
        caller: Address,
        conversation_id: BytesN<32>,
    ) -> Result<Vec<MessageRecord>, MessagingError> {
        caller.require_auth();
        let conv = load_conversation(&env, &conversation_id)?;
        assert_participant(&env, &conv, &caller)?;

        let ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::ConversationMessages(conversation_id))
            .unwrap_or(Vec::new(&env));

        let mut messages = Vec::new(&env);
        for id in ids.iter() {
            if let Some(msg) = env
                .storage()
                .persistent()
                .get::<DataKey, MessageRecord>(&DataKey::Message(id.clone()))
            {
                messages.push_back(msg);
            }
        }

        Ok(messages)
    }

    /// Fetch a single message record.  Caller must be a participant of the
    /// containing conversation.
    pub fn get_message(
        env: Env,
        caller: Address,
        message_id: BytesN<32>,
    ) -> Result<MessageRecord, MessagingError> {
        caller.require_auth();
        let msg = load_message(&env, &message_id)?;
        let conv = load_conversation(&env, &msg.conversation_id)?;
        assert_participant(&env, &conv, &caller)?;
        Ok(msg)
    }

    // ── Receipts ────────────────────────────────────────────────────────────

    /// Mark a message as delivered.  Only the *recipient* (the participant who
    /// did NOT send the message) may call this.
    pub fn mark_delivered(
        env: Env,
        caller: Address,
        message_id: BytesN<32>,
    ) -> Result<(), MessagingError> {
        caller.require_auth();

        let mut msg = load_message(&env, &message_id)?;
        let conv = load_conversation(&env, &msg.conversation_id)?;
        assert_participant(&env, &conv, &caller)?;

        // Only the recipient can mark delivered (not the sender themselves).
        if msg.sender == caller {
            return Err(MessagingError::Unauthorized);
        }

        msg.is_delivered = true;
        save_message(&env, &msg);

        events::emit_message_delivered(&env, &message_id, &msg.conversation_id);

        Ok(())
    }

    /// Mark a message as read.  Only the recipient may call this.
    pub fn mark_read(
        env: Env,
        caller: Address,
        message_id: BytesN<32>,
    ) -> Result<(), MessagingError> {
        caller.require_auth();

        let mut msg = load_message(&env, &message_id)?;
        let conv = load_conversation(&env, &msg.conversation_id)?;
        assert_participant(&env, &conv, &caller)?;

        if msg.sender == caller {
            return Err(MessagingError::Unauthorized);
        }

        msg.is_read = true;
        msg.is_delivered = true; // reading implies delivery
        save_message(&env, &msg);

        events::emit_message_read(&env, &message_id, &msg.conversation_id, &caller);

        Ok(())
    }

    // ── Deletion (tombstone) ────────────────────────────────────────────────

    /// Soft-delete a message.  Only the original sender may delete their own
    /// message.  The record is retained with `is_deleted = true` and the
    /// `message_hash` zeroed to remove content references.
    pub fn delete_message(
        env: Env,
        caller: Address,
        message_id: BytesN<32>,
    ) -> Result<(), MessagingError> {
        caller.require_auth();

        let mut msg = load_message(&env, &message_id)?;
        let conv = load_conversation(&env, &msg.conversation_id)?;
        assert_participant(&env, &conv, &caller)?;

        // Only the original sender may delete.
        if msg.sender != caller {
            return Err(MessagingError::Unauthorized);
        }

        if msg.is_deleted {
            return Err(MessagingError::MessageAlreadyDeleted);
        }

        // Tombstone: clear the hash but keep the record.
        msg.is_deleted = true;
        msg.message_hash = BytesN::from_array(&env, &[0u8; 32]);
        save_message(&env, &msg);

        events::emit_message_deleted(&env, &message_id, &msg.conversation_id, &caller);

        Ok(())
    }

    // ── TTL / Expiry ────────────────────────────────────────────────────────

    /// Explicitly mark a conversation as expired when its TTL has passed.
    /// Anyone may call this; it is a housekeeping function.
    pub fn expire_conversation(
        env: Env,
        conversation_id: BytesN<32>,
    ) -> Result<(), MessagingError> {
        let mut conv = load_conversation(&env, &conversation_id)?;
        let now = env.ledger().timestamp();

        if now <= conv.expires_at {
            return Err(MessagingError::ConversationNotFound); // not yet expired
        }

        conv.is_active = false;
        save_conversation(&env, &conv);

        events::emit_conversation_expired(&env, &conversation_id);

        Ok(())
    }

    /// Extend the TTL of a conversation.  Only participants may do this.
    pub fn extend_conversation_ttl(
        env: Env,
        caller: Address,
        conversation_id: BytesN<32>,
        extra_seconds: u64,
    ) -> Result<(), MessagingError> {
        caller.require_auth();
        let mut conv = load_conversation(&env, &conversation_id)?;
        assert_participant(&env, &conv, &caller)?;
        assert_not_expired(&env, &conv)?;

        conv.expires_at += extra_seconds;
        save_conversation(&env, &conv);

        Ok(())
    }
}
