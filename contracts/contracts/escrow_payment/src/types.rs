use soroban_sdk::{contracttype, Address, BytesN};

pub const RECORD_TTL: u32 = 3_110_400;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Active,
    Released,
    Refunded,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowRecord {
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub condition_hash: BytesN<32>,
    pub expires_at: u64,
    pub status: EscrowStatus,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Escrow(BytesN<32>),
}
