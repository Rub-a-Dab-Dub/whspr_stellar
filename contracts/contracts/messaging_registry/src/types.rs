use soroban_sdk::{contracttype, Address, BytesN, Vec};

pub const MAX_MESSAGES_PER_CONVERSATION: u32 = 10_000;
pub const CONVERSATION_TTL_LEDGERS: u32 = 535_000; // ~30 days at ~5s/ledger
pub const MESSAGE_TTL_LEDGERS: u32 = 535_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConversationRecord {
    pub id: BytesN<32>,
    pub participant_a: Address,
    pub participant_b: Address,
    pub created_at: u64,
    pub expires_at: u64,
    pub message_count: u32,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MessageRecord {
    pub id: BytesN<32>,
    pub conversation_id: BytesN<32>,
    pub sender: Address,
    pub message_hash: BytesN<32>,
    pub timestamp: u64,
    pub is_delivered: bool,
    pub is_read: bool,
    pub is_deleted: bool, // tombstone flag
}
