#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, BytesN, Env, Map, Symbol,
    Vec,
};

const JUROR_COUNT: u32 = 5;
const VOTING_WINDOW_SECONDS: u64 = 48 * 60 * 60;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DisputeStatus {
    Open = 0,
    Voting = 1,
    Resolved = 2,
    Appealed = 3,
}

#[derive(Clone)]
#[contracttype]
pub struct Dispute {
    pub claimant: Address,
    pub respondent: Address,
    pub token: Address,
    pub amount: i128,
    pub evidence_hash: BytesN<32>,
    pub jurors: Vec<Address>,
    pub votes: Map<Address, bool>,
    pub status: DisputeStatus,
    pub selected_at: u64,
    pub appeal_count: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct JurorPool {
    pub jurors: Vec<Address>,
    pub min_stake: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    JurorPool,
    JurorStake(Address),
    JurorFeeBps,
    DisputeNonce,
    Dispute(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum DisputeError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    JurorStakeTooLow = 5,
    JurorAlreadyRegistered = 6,
    JurorNotRegistered = 7,
    DisputeNotFound = 8,
    InvalidStatus = 9,
    NotJuror = 10,
    AlreadyVoted = 11,
    VotingWindowClosed = 12,
    NotParty = 13,
    NotEnoughJurors = 14,
}

#[contract]
pub struct DisputeResolutionContract;

#[contractimpl]
impl DisputeResolutionContract {
    pub fn init(env: Env, admin: Address, min_stake: i128, juror_fee_bps: u32) -> Result<(), DisputeError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(DisputeError::AlreadyInitialized);
        }
        admin.require_auth();

        let pool = JurorPool {
            jurors: Vec::new(&env),
            min_stake,
        };
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::JurorPool, &pool);
        env.storage().instance().set(&DataKey::JurorFeeBps, &juror_fee_bps);
        Ok(())
    }

    pub fn register_juror(env: Env, juror: Address, stake: i128) -> Result<(), DisputeError> {
        juror.require_auth();
        let mut pool = Self::get_pool(&env)?;
        if stake < pool.min_stake {
            return Err(DisputeError::JurorStakeTooLow);
        }
        if env.storage().instance().has(&DataKey::JurorStake(juror.clone())) {
            return Err(DisputeError::JurorAlreadyRegistered);
        }

        pool.jurors.push_back(juror.clone());
        env.storage().instance().set(&DataKey::JurorPool, &pool);
        env.storage().instance().set(&DataKey::JurorStake(juror.clone()), &stake);
        env.events().publish((Symbol::new(&env, "juror_reg"), juror), stake);
        Ok(())
    }

    pub fn deregister_juror(env: Env, juror: Address) -> Result<(), DisputeError> {
        juror.require_auth();
        let mut pool = Self::get_pool(&env)?;
        if !env.storage().instance().has(&DataKey::JurorStake(juror.clone())) {
            return Err(DisputeError::JurorNotRegistered);
        }

        let mut next = Vec::new(&env);
        for addr in pool.jurors.iter() {
            if addr != juror {
                next.push_back(addr);
            }
        }
        pool.jurors = next;
        env.storage().instance().set(&DataKey::JurorPool, &pool);
        env.storage().instance().remove(&DataKey::JurorStake(juror.clone()));
        env.events().publish((Symbol::new(&env, "juror_dereg"), juror), ());
        Ok(())
    }

    pub fn open_dispute(
        env: Env,
        claimant: Address,
        respondent: Address,
        token: Address,
        amount: i128,
        evidence_hash: BytesN<32>,
    ) -> Result<BytesN<32>, DisputeError> {
        if amount <= 0 {
            return Err(DisputeError::InvalidAmount);
        }
        claimant.require_auth();

        token::Client::new(&env, &token).transfer(&claimant, &env.current_contract_address(), &amount);

        let dispute_id = Self::next_dispute_id(&env);
        let dispute = Dispute {
            claimant: claimant.clone(),
            respondent: respondent.clone(),
            token: token.clone(),
            amount,
            evidence_hash,
            jurors: Vec::new(&env),
            votes: Map::new(&env),
            status: DisputeStatus::Open,
            selected_at: 0,
            appeal_count: 0,
        };
        env.storage()
            .instance()
            .set(&DataKey::Dispute(dispute_id.clone()), &dispute);
        env.events().publish(
            (Symbol::new(&env, "disp_open"), dispute_id.clone()),
            (claimant, respondent, token, amount),
        );
        Ok(dispute_id)
    }

    pub fn select_jurors(env: Env, dispute_id: BytesN<32>) -> Result<Vec<Address>, DisputeError> {
        let mut dispute = Self::load_dispute(&env, dispute_id.clone())?;
        if dispute.status != DisputeStatus::Open && dispute.status != DisputeStatus::Appealed {
            return Err(DisputeError::InvalidStatus);
        }

        let pool = Self::get_pool(&env)?;
        if pool.jurors.len() < JUROR_COUNT {
            return Err(DisputeError::NotEnoughJurors);
        }

        let mut selected = Vec::new(&env);
        let mut available = pool.jurors;
        let mut seed = env.ledger().sequence() as u64 + env.ledger().timestamp();

        for _ in 0..JUROR_COUNT {
            let idx = (seed % (available.len() as u64)) as u32;
            let chosen = available.get(idx).unwrap();
            selected.push_back(chosen.clone());

            let mut next = Vec::new(&env);
            for candidate in available.iter() {
                if candidate != chosen {
                    next.push_back(candidate);
                }
            }
            available = next;
            seed = seed.wrapping_mul(1_103_515_245).wrapping_add(12_345);
        }

        dispute.jurors = selected.clone();
        dispute.votes = Map::new(&env);
        dispute.status = DisputeStatus::Voting;
        dispute.selected_at = env.ledger().timestamp();
        env.storage()
            .instance()
            .set(&DataKey::Dispute(dispute_id.clone()), &dispute);
        env.events()
            .publish((Symbol::new(&env, "disp_jurors"), dispute_id), selected.clone());
        Ok(selected)
    }

    pub fn cast_verdict(
        env: Env,
        dispute_id: BytesN<32>,
        juror: Address,
        favor_claimant: bool,
    ) -> Result<(), DisputeError> {
        juror.require_auth();
        let mut dispute = Self::load_dispute(&env, dispute_id.clone())?;
        if dispute.status != DisputeStatus::Voting {
            return Err(DisputeError::InvalidStatus);
        }
        if env.ledger().timestamp() > dispute.selected_at + VOTING_WINDOW_SECONDS {
            return Err(DisputeError::VotingWindowClosed);
        }

        let mut is_juror = false;
        for j in dispute.jurors.iter() {
            if j == juror {
                is_juror = true;
                break;
            }
        }
        if !is_juror {
            return Err(DisputeError::NotJuror);
        }
        if dispute.votes.contains_key(juror.clone()) {
            return Err(DisputeError::AlreadyVoted);
        }

        dispute.votes.set(juror.clone(), favor_claimant);
        env.storage()
            .instance()
            .set(&DataKey::Dispute(dispute_id.clone()), &dispute);
        env.events().publish(
            (Symbol::new(&env, "disp_vote"), dispute_id),
            (juror, favor_claimant),
        );
        Ok(())
    }

    pub fn finalize(env: Env, dispute_id: BytesN<32>) -> Result<Address, DisputeError> {
        let mut dispute = Self::load_dispute(&env, dispute_id.clone())?;
        if dispute.status != DisputeStatus::Voting {
            return Err(DisputeError::InvalidStatus);
        }

        let votes_len = dispute.votes.len();
        let after_window = env.ledger().timestamp() > dispute.selected_at + VOTING_WINDOW_SECONDS;
        if votes_len < 3 && !after_window {
            return Err(DisputeError::InvalidStatus);
        }

        let mut claimant_votes = 0u32;
        let mut respondent_votes = 0u32;

        for (_juror, vote) in dispute.votes.iter() {
            if vote {
                claimant_votes += 1;
            } else {
                respondent_votes += 1;
            }
        }

        let winner = if claimant_votes >= respondent_votes {
            dispute.claimant.clone()
        } else {
            dispute.respondent.clone()
        };

        let fee_bps = env
            .storage()
            .instance()
            .get::<_, u32>(&DataKey::JurorFeeBps)
            .unwrap_or(100);
        let total_juror_fee = (dispute.amount * fee_bps as i128) / 10_000;
        let winner_amount = dispute.amount - total_juror_fee;

        let token_client = token::Client::new(&env, &dispute.token);
        token_client.transfer(&env.current_contract_address(), &winner, &winner_amount);

        if dispute.votes.len() > 0 && total_juror_fee > 0 {
            let juror_reward = total_juror_fee / dispute.votes.len() as i128;
            for (juror_addr, _vote) in dispute.votes.iter() {
                token_client.transfer(&env.current_contract_address(), &juror_addr, &juror_reward);
            }
        }

        dispute.status = DisputeStatus::Resolved;
        env.storage()
            .instance()
            .set(&DataKey::Dispute(dispute_id.clone()), &dispute);
        env.events().publish(
            (Symbol::new(&env, "disp_final"), dispute_id),
            (winner.clone(), winner_amount, claimant_votes, respondent_votes),
        );
        Ok(winner)
    }

    pub fn appeal(env: Env, dispute_id: BytesN<32>, appellant: Address) -> Result<(), DisputeError> {
        appellant.require_auth();
        let mut dispute = Self::load_dispute(&env, dispute_id.clone())?;
        if dispute.status != DisputeStatus::Resolved {
            return Err(DisputeError::InvalidStatus);
        }
        if appellant != dispute.claimant && appellant != dispute.respondent {
            return Err(DisputeError::NotParty);
        }

        dispute.status = DisputeStatus::Appealed;
        dispute.jurors = Vec::new(&env);
        dispute.votes = Map::new(&env);
        dispute.selected_at = 0;
        dispute.appeal_count += 1;
        env.storage()
            .instance()
            .set(&DataKey::Dispute(dispute_id.clone()), &dispute);

        env.events().publish(
            (Symbol::new(&env, "disp_appeal"), dispute_id),
            (appellant, dispute.appeal_count),
        );
        Ok(())
    }

    pub fn get_dispute(env: Env, dispute_id: BytesN<32>) -> Result<Dispute, DisputeError> {
        Self::load_dispute(&env, dispute_id)
    }

    fn get_pool(env: &Env) -> Result<JurorPool, DisputeError> {
        env.storage()
            .instance()
            .get(&DataKey::JurorPool)
            .ok_or(DisputeError::NotInitialized)
    }

    fn load_dispute(env: &Env, dispute_id: BytesN<32>) -> Result<Dispute, DisputeError> {
        env.storage()
            .instance()
            .get(&DataKey::Dispute(dispute_id))
            .ok_or(DisputeError::DisputeNotFound)
    }

    fn next_dispute_id(env: &Env) -> BytesN<32> {
        let nonce = env
            .storage()
            .instance()
            .get::<_, u64>(&DataKey::DisputeNonce)
            .unwrap_or(0)
            + 1;
        env.storage().instance().set(&DataKey::DisputeNonce, &nonce);

        let mut bytes = [0u8; 32];
        bytes[0..8].copy_from_slice(&nonce.to_be_bytes());
        bytes[8..16].copy_from_slice(&env.ledger().timestamp().to_be_bytes());
        BytesN::from_array(env, &bytes)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger as _},
        Address, Env,
    };

    #[test]
    fn open_select_vote_finalize() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|l| l.timestamp = 1000);

        let admin = Address::generate(&env);
        let claimant = Address::generate(&env);
        let respondent = Address::generate(&env);
        let token_admin = Address::generate(&env);

        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_id = token_contract.address();
        let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
        token_admin_client.mint(&claimant, &10_000);

        let contract_id = env.register_contract(None, DisputeResolutionContract);
        let client = DisputeResolutionContractClient::new(&env, &contract_id);

        client.init(&admin, &100, &100);

        let j1 = Address::generate(&env);
        let j2 = Address::generate(&env);
        let j3 = Address::generate(&env);
        let j4 = Address::generate(&env);
        let j5 = Address::generate(&env);

        client.register_juror(&j1, &200);
        client.register_juror(&j2, &210);
        client.register_juror(&j3, &220);
        client.register_juror(&j4, &230);
        client.register_juror(&j5, &240);

        let evidence = BytesN::from_array(&env, &[7u8; 32]);
        let dispute_id = client.open_dispute(&claimant, &respondent, &token_id, &1_000, &evidence);

        let jurors = client.select_jurors(&dispute_id);
        assert_eq!(jurors.len(), 5);

        let a = jurors.get(0).unwrap();
        let b = jurors.get(1).unwrap();
        let c = jurors.get(2).unwrap();
        client.cast_verdict(&dispute_id, &a, &true);
        client.cast_verdict(&dispute_id, &b, &true);
        client.cast_verdict(&dispute_id, &c, &true);

        let winner = client.finalize(&dispute_id);
        assert_eq!(winner, claimant);
    }
}
