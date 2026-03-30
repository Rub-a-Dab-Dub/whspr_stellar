#![no_std]

mod errors;
mod events;
mod types;

#[cfg(test)]
mod test;

use errors::RegistryError;
use soroban_sdk::{
    contract, contractimpl,
    token::Client as TokenClient,
    Address, BytesN, Env, String,
};
use types::{DataKey, UsernameRecord, GRACE_PERIOD, RECORD_TTL, SECS_PER_YEAR};

fn get_admin(env: &Env) -> Result<Address, RegistryError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(RegistryError::Unauthorized)
}

fn get_fee_token(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::FeeToken).unwrap()
}

fn load_record(env: &Env, username: &String) -> Option<UsernameRecord> {
    env.storage()
        .persistent()
        .get(&DataKey::Username(username.clone()))
}

fn save_record(env: &Env, record: &UsernameRecord) {
    env.storage()
        .persistent()
        .set(&DataKey::Username(record.username.clone()), record);
    env.storage().persistent().extend_ttl(
        &DataKey::Username(record.username.clone()),
        RECORD_TTL,
        RECORD_TTL,
    );
}

/// Validate username: min 3 chars, alphanumeric + hyphen only. Returns length.
fn validate_username(username: &String) -> Result<u32, RegistryError> {
    let len = username.len();
    if len < 3 {
        return Err(RegistryError::InvalidUsername);
    }
    let mut buf = [0u8; 64];
    let copy_len = (len as usize).min(64);
    username.copy_into_slice(&mut buf[..copy_len]);
    for i in 0..copy_len {
        let c = buf[i];
        let valid = (c >= b'0' && c <= b'9')
            || (c >= b'A' && c <= b'Z')
            || (c >= b'a' && c <= b'z')
            || c == b'-';
        if !valid {
            return Err(RegistryError::InvalidUsername);
        }
    }
    Ok(len)
}

fn is_available_at(record: &Option<UsernameRecord>, now: u64) -> bool {
    match record {
        None => true,
        Some(r) => now > r.expires_at + GRACE_PERIOD,
    }
}

#[contract]
pub struct UsernameRegistryContract;

#[contractimpl]
impl UsernameRegistryContract {
    pub fn initialize(env: Env, admin: Address, fee_token: Address) -> Result<(), RegistryError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeToken, &fee_token);
        Ok(())
    }

    pub fn register(
        env: Env,
        owner: Address,
        username: String,
        duration_years: u32,
    ) -> Result<(), RegistryError> {
        owner.require_auth();
        let len = validate_username(&username)?;
        let now = env.ledger().timestamp();

        let existing = load_record(&env, &username);
        if !is_available_at(&existing, now) {
            return Err(RegistryError::UsernameTaken);
        }
        if let Some(ref r) = existing {
            if now > r.expires_at && now <= r.expires_at + GRACE_PERIOD {
                return Err(RegistryError::InGracePeriod);
            }
        }

        let fee = types::registration_fee(len, duration_years);
        let fee_token = get_fee_token(&env);
        let admin = get_admin(&env)?;
        TokenClient::new(&env, &fee_token).transfer(&owner, &admin, &fee);

        let expires_at = now + SECS_PER_YEAR * duration_years as u64;
        let record = UsernameRecord {
            owner: owner.clone(),
            username: username.clone(),
            registered_at: now,
            expires_at,
            metadata_hash: None,
            is_locked: false,
        };
        save_record(&env, &record);

        if !env.storage().persistent().has(&DataKey::AddressToPrimary(owner.clone())) {
            env.storage()
                .persistent()
                .set(&DataKey::AddressToPrimary(owner.clone()), &username);
            env.storage().persistent().extend_ttl(
                &DataKey::AddressToPrimary(owner.clone()),
                RECORD_TTL,
                RECORD_TTL,
            );
        }

        events::emit_registered(&env, &username, &owner, expires_at);
        Ok(())
    }

    pub fn renew(
        env: Env,
        owner: Address,
        username: String,
        duration_years: u32,
    ) -> Result<(), RegistryError> {
        owner.require_auth();
        let len = validate_username(&username)?;
        let mut record = load_record(&env, &username).ok_or(RegistryError::UsernameNotFound)?;

        if record.owner != owner {
            return Err(RegistryError::NotOwner);
        }

        let fee = types::registration_fee(len, duration_years);
        let fee_token = get_fee_token(&env);
        let admin = get_admin(&env)?;
        TokenClient::new(&env, &fee_token).transfer(&owner, &admin, &fee);

        record.expires_at += SECS_PER_YEAR * duration_years as u64;
        let new_expires = record.expires_at;
        save_record(&env, &record);

        events::emit_renewed(&env, &username, &owner, new_expires);
        Ok(())
    }

    pub fn transfer(
        env: Env,
        username: String,
        new_owner: Address,
    ) -> Result<(), RegistryError> {
        let mut record = load_record(&env, &username).ok_or(RegistryError::UsernameNotFound)?;
        record.owner.require_auth();

        let now = env.ledger().timestamp();
        if now > record.expires_at {
            return Err(RegistryError::UsernameExpired);
        }

        let old_owner = record.owner.clone();
        record.owner = new_owner.clone();
        save_record(&env, &record);

        let primary_key = DataKey::AddressToPrimary(old_owner.clone());
        if let Some(primary) = env.storage().persistent().get::<DataKey, String>(&primary_key) {
            if primary == username {
                env.storage().persistent().remove(&primary_key);
            }
        }

        events::emit_transferred(&env, &username, &old_owner, &new_owner);
        Ok(())
    }

    pub fn release(env: Env, username: String) -> Result<(), RegistryError> {
        let record = load_record(&env, &username).ok_or(RegistryError::UsernameNotFound)?;
        record.owner.require_auth();

        let owner = record.owner.clone();
        env.storage()
            .persistent()
            .remove(&DataKey::Username(username.clone()));

        let primary_key = DataKey::AddressToPrimary(owner.clone());
        if let Some(primary) = env.storage().persistent().get::<DataKey, String>(&primary_key) {
            if primary == username {
                env.storage().persistent().remove(&primary_key);
            }
        }

        events::emit_released(&env, &username, &owner);
        Ok(())
    }

    pub fn resolve(env: Env, username: String) -> Result<Address, RegistryError> {
        let record = load_record(&env, &username).ok_or(RegistryError::UsernameNotFound)?;
        let now = env.ledger().timestamp();
        if now > record.expires_at {
            return Err(RegistryError::UsernameExpired);
        }
        Ok(record.owner)
    }

    pub fn reverse_resolve(env: Env, address: Address) -> Result<String, RegistryError> {
        env.storage()
            .persistent()
            .get(&DataKey::AddressToPrimary(address))
            .ok_or(RegistryError::NoPrimaryUsername)
    }

    pub fn is_available(env: Env, username: String) -> bool {
        let now = env.ledger().timestamp();
        is_available_at(&load_record(&env, &username), now)
    }

    pub fn set_metadata(
        env: Env,
        username: String,
        metadata_hash: BytesN<32>,
    ) -> Result<(), RegistryError> {
        let mut record = load_record(&env, &username).ok_or(RegistryError::UsernameNotFound)?;
        record.owner.require_auth();
        record.metadata_hash = Some(metadata_hash);
        save_record(&env, &record);
        Ok(())
    }
}
