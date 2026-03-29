#![no_std]

mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use events::{emit_access_denied, emit_gate_removed, emit_gate_set};
use gasless_common::{
    access_control::{
        activate_emergency_pause, deactivate_emergency_pause, init_access_control,
        require_not_paused,
    },
    types::TokenAmount,
    CommonError,
};
use soroban_sdk::{contract, contractclient, contractimpl, Address, Env};
use storage::{get_gate, remove_gate as remove_gate_storage, save_gate};
use types::{GateConfig, GroupId};

/// Minimal SEP-41 token interface — used to query the balance of a user
#[contractclient(name = "TokenClient")]
pub trait TokenInterface {
    fn balance(env: Env, id: Address) -> i128;
}

#[contract]
pub struct TokenGatingContract;

#[contractimpl]
impl TokenGatingContract {
    /// Initialize the contract, granting SUPER_ADMIN to the deployer.
    /// Must be called once before pause/unpause operations.
    pub fn initialize(env: Env, admin: Address) -> Result<(), CommonError> {
        admin.require_auth();
        init_access_control(&env, admin)
    }

    /// Emergency pause — blocks set_gate, remove_gate, and verify_access.
    /// Only callable by the SUPER_ADMIN set during initialize.
    pub fn pause(env: Env, caller: Address) -> Result<(), CommonError> {
        caller.require_auth();
        activate_emergency_pause(&env, caller)
    }

    /// Lift the emergency pause.
    pub fn unpause(env: Env, caller: Address) -> Result<(), CommonError> {
        caller.require_auth();
        deactivate_emergency_pause(&env, caller)
    }

    /// Set a token gate on a group.
    /// Only the group admin (caller) can set the gate.
    ///
    /// # Arguments
    /// * `admin`       - The group admin address (must sign this transaction)
    /// * `group_id`    - The 32-byte group identifier
    /// * `token`       - The SEP-41 token or NFT contract address
    /// * `min_balance` - Minimum token balance required (must be > 0; use 1 for NFT ownership)
    ///
    /// # Errors
    /// * `CommonError::InvalidAmount` — if min_balance <= 0
    /// * `CommonError::Unauthorized`  — if the contract is paused
    pub fn set_gate(
        env: Env,
        admin: Address,
        group_id: GroupId,
        token: Address,
        min_balance: i128,
    ) -> Result<(), CommonError> {
        admin.require_auth();
        require_not_paused(&env)?;

        // TokenAmount::new rejects <= 0 with CommonError::InvalidAmount
        let amount = TokenAmount::new(min_balance)?;

        let config = GateConfig {
            token: token.clone(),
            min_balance: amount,
            admin: admin.clone(),
            set_at: env.ledger().timestamp(),
        };

        save_gate(&env, &group_id, &config);
        emit_gate_set(&env, &group_id, &token, min_balance, &admin);
        Ok(())
    }

    /// Verify whether a user holds enough tokens to access a gated group.
    /// Returns `true` if the user passes the gate (or no gate is set), `false` otherwise.
    /// Emits an `access_denied` event when the user fails the check.
    ///
    /// Call this on every member action requiring re-verification.
    ///
    /// # Errors
    /// * `CommonError::Unauthorized` — if the contract is paused
    pub fn verify_access(env: Env, group_id: GroupId, user: Address) -> Result<bool, CommonError> {
        require_not_paused(&env)?;

        let config = match get_gate(&env, &group_id) {
            Some(c) => c,
            None => return Ok(true), // No gate set — access is open
        };

        let token_client = TokenClient::new(&env, &config.token);
        let balance = token_client.balance(&user);
        let required = config.min_balance.0;

        if balance >= required {
            Ok(true)
        } else {
            emit_access_denied(&env, &group_id, &user, required, balance);
            Ok(false)
        }
    }

    /// Remove the token gate from a group.
    /// Only the admin who set the gate can remove it.
    ///
    /// # Errors
    /// * `CommonError::InvalidInput`  — if no gate exists for this group
    /// * `CommonError::Unauthorized`  — if caller is not the gate admin, or contract is paused
    pub fn remove_gate(env: Env, admin: Address, group_id: GroupId) -> Result<(), CommonError> {
        admin.require_auth();
        require_not_paused(&env)?;

        let config = get_gate(&env, &group_id).ok_or(CommonError::InvalidInput)?;

        if config.admin != admin {
            return Err(CommonError::Unauthorized);
        }

        remove_gate_storage(&env, &group_id);
        emit_gate_removed(&env, &group_id, &admin);
        Ok(())
    }

    /// Get the gate configuration for a group.
    /// Returns `None` if no gate is configured.
    pub fn get_gate_config(env: Env, group_id: GroupId) -> Option<GateConfig> {
        get_gate(&env, &group_id)
    }
}
