#![no_std]

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use errors::UserRegistryError;
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Symbol};
use storage::DataKey;
use types::{UserRecord, USER_TTL_LEDGERS};

// ─── Internal helpers ────────────────────────────────────────────────────────

fn validate_username(username: &Symbol) -> Result<(), UserRegistryError> {
    // Username must not be empty
    if username.to_string().is_empty() {
        return Err(UserRegistryError::InvalidUsername);
    }
    Ok(())
}

fn validate_public_key(key: &BytesN<32>) -> Result<(), UserRegistryError> {
    // Check if key is all zeros
    let zero_key = BytesN::from_array(&soroban_sdk::Env::default(), &[0u8; 32]);
    if key == &zero_key {
        return Err(UserRegistryError::InvalidPublicKey);
    }
    Ok(())
}

fn load_user(env: &Env, address: &Address) -> Result<UserRecord, UserRegistryError> {
    env.storage()
        .persistent()
        .get(&DataKey::User(address.clone()))
        .ok_or(UserRegistryError::UserNotFound)
}

fn save_user(env: &Env, record: &UserRecord) {
    env.storage()
        .persistent()
        .set(&DataKey::User(record.address.clone()), record);
    env.storage().persistent().extend_ttl(
        &DataKey::User(record.address.clone()),
        USER_TTL_LEDGERS,
        USER_TTL_LEDGERS,
    );
}

fn increment_user_count(env: &Env) -> u64 {
    let count: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::UserCount)
        .unwrap_or(0)
        + 1;
    env.storage()
        .persistent()
        .set(&DataKey::UserCount, &count);
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::UserCount, USER_TTL_LEDGERS, USER_TTL_LEDGERS);
    count
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct UserRegistryContract;

#[contractimpl]
impl UserRegistryContract {
    // ── Initialisation ───────────────────────────────────────────────────────

    pub fn initialize(env: Env, admin: Address) -> Result<(), UserRegistryError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(UserRegistryError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    // ── User Registration ────────────────────────────────────────────────────

    /// Register a new user with username and public key.
    /// Fails if the user is already registered or username is taken.
    pub fn register(
        env: Env,
        address: Address,
        username: Symbol,
        public_key: BytesN<32>,
    ) -> Result<(), UserRegistryError> {
        address.require_auth();

        // Validate inputs
        validate_username(&username)?;
        validate_public_key(&public_key)?;

        // Check if user already exists
        if env
            .storage()
            .persistent()
            .has(&DataKey::User(address.clone()))
        {
            return Err(UserRegistryError::UserAlreadyRegistered);
        }

        // Check if username is already taken
        if env
            .storage()
            .persistent()
            .has(&DataKey::UsernameToAddress(username.clone()))
        {
            return Err(UserRegistryError::UsernameTaken);
        }

        let now = env.ledger().timestamp();

        let record = UserRecord {
            address: address.clone(),
            username: username.clone(),
            public_key: public_key.clone(),
            display_name: None,
            avatar_hash: None,
            registered_at: now,
            updated_at: now,
            is_active: true,
        };

        // Save user record
        save_user(&env, &record);

        // Save username mapping
        env.storage().persistent().set(
            &DataKey::UsernameToAddress(username.clone()),
            &address,
        );
        env.storage().persistent().extend_ttl(
            &DataKey::UsernameToAddress(username.clone()),
            USER_TTL_LEDGERS,
            USER_TTL_LEDGERS,
        );

        // Increment user count
        increment_user_count(&env);

        events::emit_user_registered(&env, &address, &username, &public_key, now);

        Ok(())
    }

    // ── Profile Update ───────────────────────────────────────────────────────

    /// Update user profile with display name and/or avatar hash.
    pub fn update_profile(
        env: Env,
        address: Address,
        display_name: Option<Symbol>,
        avatar_hash: Option<BytesN<32>>,
    ) -> Result<(), UserRegistryError> {
        address.require_auth();

        let mut record = load_user(&env, &address)?;

        if !record.is_active {
            return Err(UserRegistryError::AccountDeactivated);
        }

        let now = env.ledger().timestamp();

        record.display_name = display_name.clone();
        record.avatar_hash = avatar_hash.clone();
        record.updated_at = now;

        save_user(&env, &record);

        events::emit_profile_updated(&env, &address, &display_name, &avatar_hash, now);

        Ok(())
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    /// Get user record by address.
    pub fn get_user(env: Env, address: Address) -> Result<UserRecord, UserRegistryError> {
        load_user(&env, &address)
    }

    /// Resolve username to address.
    pub fn resolve_username(env: Env, username: Symbol) -> Result<Address, UserRegistryError> {
        env.storage()
            .persistent()
            .get(&DataKey::UsernameToAddress(username))
            .ok_or(UserRegistryError::UserNotFound)
    }

    /// Check if a username is available.
    pub fn is_username_available(env: Env, username: Symbol) -> bool {
        !env.storage()
            .persistent()
            .has(&DataKey::UsernameToAddress(username))
    }

    /// Get total registered user count.
    pub fn get_user_count(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::UserCount)
            .unwrap_or(0)
    }

    // ── Account Management ───────────────────────────────────────────────────

    /// Deactivate the caller's account.
    pub fn deactivate_account(env: Env, address: Address) -> Result<(), UserRegistryError> {
        address.require_auth();

        let mut record = load_user(&env, &address)?;

        if !record.is_active {
            return Err(UserRegistryError::AccountDeactivated);
        }

        let now = env.ledger().timestamp();

        record.is_active = false;
        record.updated_at = now;

        save_user(&env, &record);

        events::emit_account_deactivated(&env, &address, &record.username, now);

        Ok(())
    }

    /// Admin override to deactivate any account.
    pub fn admin_deactivate_account(
        env: Env,
        admin: Address,
        target: Address,
    ) -> Result<(), UserRegistryError> {
        admin.require_auth();

        // Verify admin
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(UserRegistryError::NotInitialized)?;

        if admin != stored_admin {
            return Err(UserRegistryError::Unauthorized);
        }

        let mut record = load_user(&env, &target)?;

        if !record.is_active {
            return Err(UserRegistryError::AccountDeactivated);
        }

        let now = env.ledger().timestamp();

        record.is_active = false;
        record.updated_at = now;

        save_user(&env, &record);

        events::emit_account_deactivated(&env, &target, &record.username, now);

        Ok(())
    }

    // ── Admin Functions ──────────────────────────────────────────────────────

    /// Get the admin address.
    pub fn get_admin(env: Env) -> Result<Address, UserRegistryError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(UserRegistryError::NotInitialized)
    }
}
