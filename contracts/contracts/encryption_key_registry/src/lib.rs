#![no_std]

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use errors::KeyRegistryError;
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Symbol, Vec};
use storage::DataKey;
use types::{KeyRecord, KEY_TTL_LEDGERS, MAX_KEY_HISTORY};

// ─── Internal helpers ────────────────────────────────────────────────────────

/// Validate that a public key is not all-zero bytes.
fn validate_public_key(key: &BytesN<32>) -> Result<(), KeyRegistryError> {
    if key == &BytesN::from_array(&soroban_sdk::Env::default(), &[0u8; 32]) {
        return Err(KeyRegistryError::InvalidPublicKey);
    }
    Ok(())
}

fn load_active_key(env: &Env, owner: &Address) -> Result<KeyRecord, KeyRegistryError> {
    env.storage()
        .persistent()
        .get(&DataKey::ActiveKey(owner.clone()))
        .ok_or(KeyRegistryError::KeyNotFound)
}

fn save_active_key(env: &Env, owner: &Address, record: &KeyRecord) {
    env.storage()
        .persistent()
        .set(&DataKey::ActiveKey(owner.clone()), record);
    env.storage().persistent().extend_ttl(
        &DataKey::ActiveKey(owner.clone()),
        KEY_TTL_LEDGERS,
        KEY_TTL_LEDGERS,
    );
}

fn next_version(env: &Env, owner: &Address) -> u32 {
    let version: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::KeyVersion(owner.clone()))
        .unwrap_or(0)
        + 1;
    env.storage()
        .persistent()
        .set(&DataKey::KeyVersion(owner.clone()), &version);
    env.storage().persistent().extend_ttl(
        &DataKey::KeyVersion(owner.clone()),
        KEY_TTL_LEDGERS,
        KEY_TTL_LEDGERS,
    );
    version
}

/// Append a record to the owner's key history, capping at MAX_KEY_HISTORY.
fn push_history(env: &Env, owner: &Address, record: KeyRecord) {
    let key = DataKey::KeyHistory(owner.clone());
    let mut history: Vec<KeyRecord> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env));

    // Evict oldest entry when cap is reached to keep storage bounded.
    if history.len() >= MAX_KEY_HISTORY {
        history.remove(0);
    }
    history.push_back(record);

    env.storage().persistent().set(&key, &history);
    env.storage()
        .persistent()
        .extend_ttl(&key, KEY_TTL_LEDGERS, KEY_TTL_LEDGERS);
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct EncryptionKeyRegistryContract;

#[contractimpl]
impl EncryptionKeyRegistryContract {
    // ── Initialisation ───────────────────────────────────────────────────────

    pub fn initialize(env: Env, admin: Address) -> Result<(), KeyRegistryError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(KeyRegistryError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    // ── Key Registration ─────────────────────────────────────────────────────

    /// Register the caller's first public key.  Fails if they already have an
    /// active key — use `rotate_key` to update it.
    pub fn register_key(
        env: Env,
        owner: Address,
        public_key: BytesN<32>,
        key_type: Symbol,
    ) -> Result<u32, KeyRegistryError> {
        owner.require_auth();

        // All-zero key is invalid.
        if public_key == BytesN::from_array(&env, &[0u8; 32]) {
            return Err(KeyRegistryError::InvalidPublicKey);
        }

        // Reject if an active (non-revoked) key already exists.
        if let Some(existing) = env
            .storage()
            .persistent()
            .get::<DataKey, KeyRecord>(&DataKey::ActiveKey(owner.clone()))
        {
            if existing.is_active {
                // They must call rotate_key instead.
                return Err(KeyRegistryError::Unauthorized);
            }
        }

        let now = env.ledger().timestamp();
        let version = next_version(&env, &owner);

        let record = KeyRecord {
            public_key: public_key.clone(),
            key_type,
            version,
            registered_at: now,
            revoked_at: 0,
            is_active: true,
        };

        save_active_key(&env, &owner, &record);
        push_history(&env, &owner, record.clone());

        events::emit_key_registered(&env, &owner, &public_key, version, now);

        Ok(version)
    }

    /// Atomically replace the caller's active key with a new one.
    /// The previous key is archived in history with its `is_active` flag cleared.
    pub fn rotate_key(
        env: Env,
        owner: Address,
        new_public_key: BytesN<32>,
        key_type: Symbol,
    ) -> Result<u32, KeyRegistryError> {
        owner.require_auth();

        if new_public_key == BytesN::from_array(&env, &[0u8; 32]) {
            return Err(KeyRegistryError::InvalidPublicKey);
        }

        let mut old_record = load_active_key(&env, &owner)?;

        if !old_record.is_active {
            return Err(KeyRegistryError::NoActiveKey);
        }

        let now = env.ledger().timestamp();
        let old_key = old_record.public_key.clone();

        // Archive the old record — mark inactive (not revoked, just superseded).
        old_record.is_active = false;
        push_history(&env, &owner, old_record);

        // Create the new active record.
        let new_version = next_version(&env, &owner);
        let new_record = KeyRecord {
            public_key: new_public_key.clone(),
            key_type,
            version: new_version,
            registered_at: now,
            revoked_at: 0,
            is_active: true,
        };

        save_active_key(&env, &owner, &new_record);
        push_history(&env, &owner, new_record);

        events::emit_key_rotated(&env, &owner, &old_key, &new_public_key, new_version, now);

        Ok(new_version)
    }

    /// Revoke the caller's active key without providing a replacement.
    /// The key record is updated with a `revoked_at` timestamp and `is_active = false`.
    pub fn revoke_key(env: Env, owner: Address) -> Result<(), KeyRegistryError> {
        owner.require_auth();

        let mut record = load_active_key(&env, &owner)?;

        if !record.is_active {
            return Err(KeyRegistryError::KeyAlreadyRevoked);
        }

        let now = env.ledger().timestamp();
        let revoked_key = record.public_key.clone();
        let version = record.version;

        record.is_active = false;
        record.revoked_at = now;

        // Persist the revoked state as the active-slot record (so callers
        // learn it is revoked rather than getting KeyNotFound).
        save_active_key(&env, &owner, &record);
        push_history(&env, &owner, record);

        events::emit_key_revoked(&env, &owner, &revoked_key, version, now);

        Ok(())
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    /// Return the active key record for `address`.
    /// Returns `KeyNotFound` if no key has ever been registered.
    /// Returns the record (with `is_active = false`) if it has been revoked —
    /// callers should check `is_active` before trusting the key.
    pub fn get_key(env: Env, address: Address) -> Result<KeyRecord, KeyRegistryError> {
        load_active_key(&env, &address)
    }

    /// Return the full key history for `address`, oldest first.
    /// Anyone may query this; histories are public by design (public keys are
    /// not secret).
    pub fn get_key_history(env: Env, address: Address) -> Vec<KeyRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::KeyHistory(address))
            .unwrap_or(Vec::new(&env))
    }

    /// Convenience: returns true only when `address` has an active,
    /// non-revoked key.
    pub fn has_active_key(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get::<DataKey, KeyRecord>(&DataKey::ActiveKey(address))
            .map(|r| r.is_active)
            .unwrap_or(false)
    }
}
