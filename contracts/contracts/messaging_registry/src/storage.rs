use soroban_sdk::{contracttype, Address, BytesN};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // ConversationRecord keyed by conversation_id
    Conversation(BytesN<32>),
    // MessageRecord keyed by message_id
    Message(BytesN<32>),
    // List of message IDs for a conversation: Vec<BytesN<32>>
    ConversationMessages(BytesN<32>),
    // Lookup: sorted pair (a, b) -> conversation_id for dedup
    ParticipantConversation(Address, Address),
    // Admin address
    Admin,
}
