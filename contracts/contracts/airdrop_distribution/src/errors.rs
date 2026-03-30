use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AirdropError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    CampaignNotFound = 3,
    CampaignExpired = 4,
    CampaignNotActive = 5,
    AlreadyClaimed = 6,
    InvalidMerkleProof = 7,
    InvalidTimeRange = 8,
    CampaignNotStarted = 9,
}
