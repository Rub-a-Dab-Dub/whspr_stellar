#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec, panic_with_error, symbol_short, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Campaign(BytesN<32>),
    Claimed(BytesN<32>, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignRecord {
    pub token: Address,
    pub total_amount: i128,
    pub claimed_amount: i128,
    pub merkle_root: BytesN<32>,
    pub start: u64,
    pub end: u64,
    pub admin: Address,
}

#[contract]
pub struct AirdropContract;

#[contractimpl]
impl AirdropContract {
    /// Initialize the contract with an admin
    pub fn init(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Create a new airdrop campaign
    pub fn create_campaign(
        env: Env,
        campaign_id: BytesN<32>,
        token: Address,
        total_amount: i128,
        merkle_root: BytesN<32>,
        start: u64,
        end: u64,
    ) -> BytesN<32> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let campaign = CampaignRecord {
            token,
            total_amount,
            claimed_amount: 0,
            merkle_root,
            start,
            end,
            admin: admin.clone(),
        };

        env.storage().persistent().set(&DataKey::Campaign(campaign_id.clone()), &campaign);
        campaign_id
    }

    /// Claim tokens from a campaign using a Merkle Proof
    pub fn claim(
        env: Env,
        campaign_id: BytesN<32>,
        user: Address,
        amount: i128,
        merkle_proof: Vec<BytesN<32>>,
    ) {
        user.require_auth();

        // Check if already claimed
        if env.storage().persistent().has(&DataKey::Claimed(campaign_id.clone(), user.clone())) {
            panic!("Already claimed");
        }

        let mut campaign: CampaignRecord = env.storage().persistent().get(&DataKey::Campaign(campaign_id.clone())).unwrap();
        
        // Timing checks
        let now = env.ledger().timestamp();
        if now < campaign.start || now > campaign.end {
            panic!("Campaign not active");
        }

        // Verify Merkle Proof
        let leaf = env.crypto().sha256(&env.crypto().sha256(&user.to_xdr_bytes())); // Simplified leaf
        if !Self::verify_merkle_proof(env.clone(), merkle_proof, campaign.merkle_root.clone(), leaf) {
            panic!("Invalid proof");
        }

        // Update state and transfer
        campaign.claimed_amount += amount;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id.clone()), &campaign);
        env.storage().persistent().set(&DataKey::Claimed(campaign_id, user.clone()), &true);

        // Perform token transfer (Requires Token Interface)
        // let client = token::Client::new(&env, &campaign.token);
        // client.transfer(&env.current_contract_address(), &user, &amount);
    }

    pub fn verify_merkle_proof(env: Env, proof: Vec<BytesN<32>>, root: BytesN<32>, leaf: BytesN<32>) -> bool {
        let mut computed_hash = leaf;
        for p in proof.iter() {
            let mut combined = Vec::new(&env);
            if computed_hash < p {
                combined.push_back(computed_hash);
                combined.push_back(p);
            } else {
                combined.push_back(p);
                combined.push_back(computed_hash);
            }
            computed_hash = env.crypto().sha256(&combined.to_xdr_bytes());
        }
        computed_hash == root
    }

    pub fn get_campaign(env: Env, campaign_id: BytesN<32>) -> CampaignRecord {
        env.storage().persistent().get(&DataKey::Campaign(campaign_id)).unwrap()
    }
}
