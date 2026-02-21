use soroban_sdk::{contracttype, Address};

/// Represents the current status of a claim in the system.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ClaimStatus {
    /// The claim has been created and is awaiting action by the recipient.
    Pending,
    /// The recipient has successfully claimed the funds.
    Claimed,
    /// The claim was cancelled by the creator before it was claimed.
    Cancelled,
    /// The claim window has passed and the claim can no longer be collected.
    Expired,
}

/// Represents a pending claim that a beneficiary must claim within the configured window.
///
/// Claims are created by a `creator` for a `recipient` and must be claimed before
/// `expires_at`. Once the expiry passes without action, the claim is considered
/// [`ClaimStatus::Expired`]. The creator may also cancel an unclaimed claim at any time.
#[contracttype]
#[derive(Clone, Debug)]
pub struct PendingClaim {
    /// Unique identifier for this claim.
    pub id: u64,

    /// The amount of tokens (in the smallest unit) to be transferred upon claiming.
    pub amount: i128,

    /// The contract address of the token to be transferred.
    pub token: Address,

    /// The address of the beneficiary who is entitled to claim the funds.
    pub recipient: Address,

    /// The address of the account that created this claim.
    pub creator: Address,

    /// The ledger timestamp (Unix epoch, seconds) at which this claim was created.
    pub created_at: u64,

    /// The ledger timestamp (Unix epoch, seconds) after which this claim can no longer be claimed.
    pub expires_at: u64,

    /// Whether the recipient has successfully claimed the funds.
    pub claimed: bool,

    /// Whether the creator has cancelled this claim before it was claimed.
    pub cancelled: bool,
}
