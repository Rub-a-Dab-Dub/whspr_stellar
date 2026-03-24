#![no_std]

use gasless_common::migration;
use gasless_common::upgrade;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env,
    Symbol,
};

const DEFAULT_QUORUM_VOTES: u32 = 2;
const DEFAULT_MAJORITY_BPS: u32 = 5001;
const DEFAULT_PROPOSAL_TTL_LEDGERS: u32 = 100;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct TreasuryRecord {
    pub group_id: BytesN<32>,
    pub balance: i128,
    pub quorum_votes: u32,
    pub majority_bps: u32,
    pub proposal_ttl_ledgers: u32,
    pub next_proposal_nonce: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ProposalRecord {
    pub proposal_id: BytesN<32>,
    pub group_id: BytesN<32>,
    pub recipient: Address,
    pub amount: i128,
    pub description: Symbol,
    pub created_ledger: u32,
    pub expires_ledger: u32,
    pub yes_votes: u32,
    pub no_votes: u32,
    pub total_votes: u32,
    pub executed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct VoteRecord {
    pub proposal_id: BytesN<32>,
    pub vote_index: u32,
    pub approve: bool,
    pub voted_ledger: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Treasury(BytesN<32>),
    Proposal(BytesN<32>),
    ProposalVote(BytesN<32>, u32),
    Admin,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    InvalidAmount = 1,
    ProposalNotFound = 2,
    TreasuryNotFound = 3,
    InsufficientTreasuryBalance = 4,
    ProposalExpired = 5,
    ProposalAlreadyExecuted = 6,
    QuorumNotMet = 7,
    MajorityNotMet = 8,
    InvalidThreshold = 9,
}

#[contract]
pub struct DaoTreasuryContract;

#[contractimpl]
impl DaoTreasuryContract {
    pub fn deposit(env: Env, group_id: BytesN<32>, amount: i128) -> Result<(), ContractError> {
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let mut treasury = Self::get_or_create_treasury(&env, group_id.clone())?;
        treasury.balance = treasury
            .balance
            .checked_add(amount)
            .ok_or(ContractError::InvalidAmount)?;

        env.storage()
            .persistent()
            .set(&DataKey::Treasury(group_id.clone()), &treasury);

        env.events().publish(
            (Symbol::new(&env, "deposit"), group_id),
            (amount, treasury.balance, env.ledger().timestamp()),
        );

        Ok(())
    }

    pub fn create_proposal(
        env: Env,
        group_id: BytesN<32>,
        recipient: Address,
        amount: i128,
        description: Symbol,
    ) -> Result<BytesN<32>, ContractError> {
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let mut treasury = Self::get_or_create_treasury(&env, group_id.clone())?;

        let proposal_id = Self::build_proposal_id(&env, &group_id, treasury.next_proposal_nonce);
        treasury.next_proposal_nonce = treasury
            .next_proposal_nonce
            .checked_add(1)
            .ok_or(ContractError::InvalidAmount)?;

        let created_ledger = env.ledger().sequence();
        let expires_ledger = created_ledger.saturating_add(treasury.proposal_ttl_ledgers);

        let proposal = ProposalRecord {
            proposal_id: proposal_id.clone(),
            group_id: group_id.clone(),
            recipient: recipient.clone(),
            amount,
            description,
            created_ledger,
            expires_ledger,
            yes_votes: 0,
            no_votes: 0,
            total_votes: 0,
            executed: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Treasury(group_id.clone()), &treasury);
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id.clone()), &proposal);

        env.events().publish(
            (Symbol::new(&env, "proposal_created"), proposal_id.clone()),
            (
                group_id,
                recipient,
                amount,
                proposal.expires_ledger,
                env.ledger().timestamp(),
            ),
        );

        Ok(proposal_id)
    }

    pub fn vote(env: Env, proposal_id: BytesN<32>, approve: bool) -> Result<(), ContractError> {
        let mut proposal = Self::get_proposal(env.clone(), proposal_id.clone())?;

        if proposal.executed {
            return Err(ContractError::ProposalAlreadyExecuted);
        }

        if Self::is_expired(&env, &proposal) {
            return Err(ContractError::ProposalExpired);
        }

        if approve {
            proposal.yes_votes = proposal.yes_votes.saturating_add(1);
        } else {
            proposal.no_votes = proposal.no_votes.saturating_add(1);
        }
        proposal.total_votes = proposal.total_votes.saturating_add(1);

        let vote_record = VoteRecord {
            proposal_id: proposal_id.clone(),
            vote_index: proposal.total_votes,
            approve,
            voted_ledger: env.ledger().sequence(),
        };

        env.storage().persistent().set(
            &DataKey::ProposalVote(proposal_id.clone(), vote_record.vote_index),
            &vote_record,
        );
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id.clone()), &proposal);

        env.events().publish(
            (Symbol::new(&env, "vote_cast"), proposal_id),
            (
                approve,
                proposal.yes_votes,
                proposal.no_votes,
                proposal.total_votes,
                env.ledger().timestamp(),
            ),
        );

        Ok(())
    }

    pub fn execute_proposal(env: Env, proposal_id: BytesN<32>) -> Result<(), ContractError> {
        let mut proposal = Self::get_proposal(env.clone(), proposal_id.clone())?;

        if proposal.executed {
            return Err(ContractError::ProposalAlreadyExecuted);
        }

        if Self::is_expired(&env, &proposal) {
            return Err(ContractError::ProposalExpired);
        }

        let mut treasury = env
            .storage()
            .persistent()
            .get::<_, TreasuryRecord>(&DataKey::Treasury(proposal.group_id.clone()))
            .ok_or(ContractError::TreasuryNotFound)?;

        if proposal.total_votes < treasury.quorum_votes {
            return Err(ContractError::QuorumNotMet);
        }

        let lhs = (proposal.yes_votes as u128) * 10_000u128;
        let rhs = (proposal.total_votes as u128) * (treasury.majority_bps as u128);
        if lhs < rhs {
            return Err(ContractError::MajorityNotMet);
        }

        if proposal.amount > treasury.balance {
            return Err(ContractError::InsufficientTreasuryBalance);
        }

        treasury.balance -= proposal.amount;
        proposal.executed = true;

        env.storage()
            .persistent()
            .set(&DataKey::Treasury(proposal.group_id.clone()), &treasury);
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id.clone()), &proposal);

        env.events().publish(
            (Symbol::new(&env, "proposal_executed"), proposal_id),
            (
                proposal.group_id,
                proposal.recipient,
                proposal.amount,
                treasury.balance,
                env.ledger().timestamp(),
            ),
        );

        Ok(())
    }

    pub fn get_treasury_balance(env: Env, group_id: BytesN<32>) -> i128 {
        env.storage()
            .persistent()
            .get::<_, TreasuryRecord>(&DataKey::Treasury(group_id))
            .map(|record| record.balance)
            .unwrap_or(0)
    }

    pub fn get_proposal(
        env: Env,
        proposal_id: BytesN<32>,
    ) -> Result<ProposalRecord, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(ContractError::ProposalNotFound)
    }

    fn get_or_create_treasury(
        env: &Env,
        group_id: BytesN<32>,
    ) -> Result<TreasuryRecord, ContractError> {
        if let Some(record) = env
            .storage()
            .persistent()
            .get::<_, TreasuryRecord>(&DataKey::Treasury(group_id.clone()))
        {
            if record.majority_bps == 0 || record.majority_bps > 10_000 {
                return Err(ContractError::InvalidThreshold);
            }
            return Ok(record);
        }

        Ok(TreasuryRecord {
            group_id,
            balance: 0,
            quorum_votes: DEFAULT_QUORUM_VOTES,
            majority_bps: DEFAULT_MAJORITY_BPS,
            proposal_ttl_ledgers: DEFAULT_PROPOSAL_TTL_LEDGERS,
            next_proposal_nonce: 1,
        })
    }

    fn build_proposal_id(env: &Env, group_id: &BytesN<32>, nonce: u64) -> BytesN<32> {
        let mut seed = Bytes::new(env);
        seed.append(&Bytes::from_array(env, &group_id.to_array()));
        seed.append(&Bytes::from_array(env, &nonce.to_be_bytes()));
        env.crypto().sha256(&seed).into()
    }

    fn is_expired(env: &Env, proposal: &ProposalRecord) -> bool {
        env.ledger().sequence() > proposal.expires_ledger
    }

    // ──────────────────────────────────────────────
    // Upgrade & Migration Functions
    // ──────────────────────────────────────────────

    pub fn init(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::InvalidThreshold);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);

        let wasm_hash_bytes: BytesN<32> = BytesN::from_array(&env, &[0u8; 32]);
        upgrade::init_upgrade(&env, admin, 1u32, wasm_hash_bytes)
            .map_err(|_| ContractError::InvalidThreshold)
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::InvalidThreshold)?;
        admin.require_auth();

        upgrade::require_multi_sig_signer(&env, &admin)
            .map_err(|_| ContractError::InvalidThreshold)?;

        migration::validate_pre_upgrade(&env).map_err(|_| ContractError::InvalidThreshold)?;

        let current_version =
            upgrade::get_version(&env).map_err(|_| ContractError::InvalidThreshold)?;
        let current_wasm_hash =
            upgrade::get_current_wasm_hash(&env).map_err(|_| ContractError::InvalidThreshold)?;

        env.storage()
            .instance()
            .set(&upgrade::UpgradeKey::PreviousWasmHash, &current_wasm_hash);
        env.storage()
            .instance()
            .set(&upgrade::UpgradeKey::CurrentWasmHash, &new_wasm_hash);

        upgrade::record_upgrade(&env, current_version, new_wasm_hash.clone(), admin.clone())
            .map_err(|_| ContractError::InvalidThreshold)?;

        env.events().publish(
            (symbol_short!("upgrade"), admin.clone()),
            (current_version, new_wasm_hash),
        );

        Ok(())
    }

    pub fn migrate_state(
        env: Env,
        from_version: u32,
        to_version: u32,
    ) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::InvalidThreshold)?;
        admin.require_auth();

        upgrade::is_compatible_upgrade(from_version, to_version)
            .map_err(|_| ContractError::InvalidThreshold)?;

        migration::validate_pre_upgrade(&env).map_err(|_| ContractError::InvalidThreshold)?;

        env.storage()
            .instance()
            .set(&upgrade::UpgradeKey::ContractVersion, &to_version);

        upgrade::record_migration(&env, from_version, to_version, true)
            .map_err(|_| ContractError::InvalidThreshold)?;

        migration::verify_post_upgrade(&env).map_err(|_| ContractError::InvalidThreshold)?;

        env.events().publish(
            (symbol_short!("migrate"), admin.clone()),
            (from_version, to_version),
        );

        Ok(())
    }

    pub fn verify_upgrade(env: Env) -> Result<bool, ContractError> {
        migration::verify_post_upgrade(&env).map_err(|_| ContractError::InvalidThreshold)?;

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::InvalidThreshold)?;

        if admin.clone() == admin {
            Ok(true)
        } else {
            Err(ContractError::InvalidThreshold)
        }
    }
}

#[cfg(test)]
mod test;
