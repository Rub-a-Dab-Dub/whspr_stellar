#![allow(dead_code)]

use crate::CommonError;
use soroban_sdk::{contracttype, Address, Env, Symbol};

/// Role definitions for access control
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum Role {
    SuperAdmin = 0,
    PlatformAdmin = 1,
    ContractAdmin = 2,
    Moderator = 3,
}

impl Role {
    /// Convert Symbol to Role
    pub fn from_symbol(env: &Env, symbol: &Symbol) -> Result<Self, CommonError> {
        let super_admin = Symbol::new(env, "SUPER_ADMIN");
        let platform_admin = Symbol::new(env, "PLATFORM_ADMIN");
        let contract_admin = Symbol::new(env, "CONTRACT_ADMIN");
        let moderator = Symbol::new(env, "MODERATOR");

        if symbol == &super_admin {
            Ok(Role::SuperAdmin)
        } else if symbol == &platform_admin {
            Ok(Role::PlatformAdmin)
        } else if symbol == &contract_admin {
            Ok(Role::ContractAdmin)
        } else if symbol == &moderator {
            Ok(Role::Moderator)
        } else {
            Err(CommonError::InvalidInput)
        }
    }

    /// Convert Role to Symbol
    pub fn to_symbol(&self, env: &Env) -> Symbol {
        match self {
            Role::SuperAdmin => Symbol::new(env, "SUPER_ADMIN"),
            Role::PlatformAdmin => Symbol::new(env, "PLATFORM_ADMIN"),
            Role::ContractAdmin => Symbol::new(env, "CONTRACT_ADMIN"),
            Role::Moderator => Symbol::new(env, "MODERATOR"),
        }
    }
}

/// Storage keys for access control
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AccessControlKey {
    /// Maps (role, address) -> bool
    RoleGrant(Symbol, Address),
    /// Pending role transfer: (role, from_address) -> to_address
    PendingRoleTransfer(Symbol, Address),
    /// Emergency pause state
    EmergencyPaused,
    /// Pause initiator
    PauseInitiator,
}

/// Initialize access control for a contract
pub fn init_access_control(env: &Env, admin: Address) -> Result<(), CommonError> {
    // Grant SUPER_ADMIN role to the initial admin
    let super_admin_symbol = Symbol::new(env, "SUPER_ADMIN");
    env.storage().persistent().set(
        &AccessControlKey::RoleGrant(super_admin_symbol, admin.clone()),
        &true,
    );

    Ok(())
}

/// Grant a role to an address
pub fn grant_role(
    env: &Env,
    role: Symbol,
    address: Address,
    caller: Address,
) -> Result<(), CommonError> {
    // Only SUPER_ADMIN or PLATFORM_ADMIN can grant roles
    require_role(env, Symbol::new(env, "SUPER_ADMIN"), caller.clone())?;

    let key = AccessControlKey::RoleGrant(role.clone(), address.clone());
    env.storage().persistent().set(&key, &true);

    // Emit event
    env.events().publish(
        (Symbol::new(env, "role_granted"), role, address.clone()),
        caller,
    );

    Ok(())
}

/// Revoke a role from an address
pub fn revoke_role(
    env: &Env,
    role: Symbol,
    address: Address,
    caller: Address,
) -> Result<(), CommonError> {
    // Only SUPER_ADMIN can revoke roles
    require_role(env, Symbol::new(env, "SUPER_ADMIN"), caller.clone())?;

    let key = AccessControlKey::RoleGrant(role.clone(), address.clone());
    env.storage().persistent().remove(&key);

    // Emit event
    env.events().publish(
        (Symbol::new(env, "role_revoked"), role, address.clone()),
        caller,
    );

    Ok(())
}

/// Check if an address has a specific role
pub fn has_role(env: &Env, role: Symbol, address: Address) -> bool {
    let key = AccessControlKey::RoleGrant(role, address);
    env.storage()
        .persistent()
        .get::<_, bool>(&key)
        .unwrap_or(false)
}

/// Require that caller has a specific role (auth guard)
pub fn require_role(env: &Env, role: Symbol, caller: Address) -> Result<(), CommonError> {
    if !has_role(env, role, caller) {
        return Err(CommonError::Unauthorized);
    }
    Ok(())
}

/// Initiate a two-step role transfer
pub fn initiate_role_transfer(
    env: &Env,
    role: Symbol,
    from: Address,
    to: Address,
    caller: Address,
) -> Result<(), CommonError> {
    // Only the current role holder or SUPER_ADMIN can initiate transfer
    if caller != from {
        require_role(env, Symbol::new(env, "SUPER_ADMIN"), caller.clone())?;
    }

    // Verify 'from' actually has the role
    if !has_role(env, role.clone(), from.clone()) {
        return Err(CommonError::Unauthorized);
    }

    // Store pending transfer
    let key = AccessControlKey::PendingRoleTransfer(role.clone(), from.clone());
    env.storage().persistent().set(&key, &to.clone());

    // Emit event
    env.events().publish(
        (Symbol::new(env, "role_transfer_initiated"), role, from),
        to,
    );

    Ok(())
}

/// Accept a pending role transfer
pub fn accept_role_transfer(
    env: &Env,
    role: Symbol,
    from: Address,
    caller: Address,
) -> Result<(), CommonError> {
    // Verify there's a pending transfer for this role
    let key = AccessControlKey::PendingRoleTransfer(role.clone(), from.clone());
    let pending_to: Address = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(CommonError::InvalidInput)?;

    // Only the intended recipient can accept
    if caller != pending_to {
        return Err(CommonError::Unauthorized);
    }

    // Remove the role from 'from'
    let role_key = AccessControlKey::RoleGrant(role.clone(), from.clone());
    env.storage().persistent().remove(&role_key);

    // Grant the role to 'to'
    let new_role_key = AccessControlKey::RoleGrant(role.clone(), pending_to.clone());
    env.storage().persistent().set(&new_role_key, &true);

    // Remove pending transfer
    env.storage().persistent().remove(&key);

    // Emit event
    env.events().publish(
        (Symbol::new(env, "role_transfer_accepted"), role, from),
        pending_to,
    );

    Ok(())
}

/// Reject a pending role transfer
pub fn reject_role_transfer(
    env: &Env,
    role: Symbol,
    from: Address,
    caller: Address,
) -> Result<(), CommonError> {
    // Verify there's a pending transfer for this role
    let key = AccessControlKey::PendingRoleTransfer(role.clone(), from.clone());
    let pending_to: Address = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(CommonError::InvalidInput)?;

    // Only the intended recipient or SUPER_ADMIN can reject
    if caller != pending_to {
        require_role(env, Symbol::new(env, "SUPER_ADMIN"), caller.clone())?;
    }

    // Remove pending transfer
    env.storage().persistent().remove(&key);

    // Emit event
    env.events().publish(
        (Symbol::new(env, "role_transfer_rejected"), role, from),
        caller,
    );

    Ok(())
}

/// Activate emergency pause
pub fn activate_emergency_pause(env: &Env, caller: Address) -> Result<(), CommonError> {
    // Only SUPER_ADMIN can activate emergency pause
    require_role(env, Symbol::new(env, "SUPER_ADMIN"), caller.clone())?;

    env.storage()
        .instance()
        .set(&AccessControlKey::EmergencyPaused, &true);
    env.storage()
        .instance()
        .set(&AccessControlKey::PauseInitiator, &caller.clone());

    // Emit event
    env.events()
        .publish((Symbol::new(env, "emergency_pause_activated"),), caller);

    Ok(())
}

/// Deactivate emergency pause
pub fn deactivate_emergency_pause(env: &Env, caller: Address) -> Result<(), CommonError> {
    // Only SUPER_ADMIN can deactivate emergency pause
    require_role(env, Symbol::new(env, "SUPER_ADMIN"), caller.clone())?;

    env.storage()
        .instance()
        .set(&AccessControlKey::EmergencyPaused, &false);

    // Emit event
    env.events()
        .publish((Symbol::new(env, "emergency_pause_deactivated"),), caller);

    Ok(())
}

/// Check if contract is in emergency pause
pub fn is_emergency_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<_, bool>(&AccessControlKey::EmergencyPaused)
        .unwrap_or(false)
}

/// Require that contract is not paused
pub fn require_not_paused(env: &Env) -> Result<(), CommonError> {
    if is_emergency_paused(env) {
        return Err(CommonError::Unauthorized);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env, Symbol};

    #[contract]
    pub struct AccessControlTest;

    #[contractimpl]
    impl AccessControlTest {
        pub fn init(env: Env, admin: Address) {
            init_access_control(&env, admin).unwrap();
        }

        pub fn grant(env: Env, role: Symbol, address: Address, caller: Address) {
            grant_role(&env, role, address, caller).unwrap();
        }

        pub fn revoke(env: Env, role: Symbol, address: Address, caller: Address) {
            revoke_role(&env, role, address, caller).unwrap();
        }

        pub fn check_role(env: Env, role: Symbol, address: Address) -> bool {
            has_role(&env, role, address)
        }

        pub fn require(env: Env, role: Symbol, caller: Address) {
            require_role(&env, role, caller).unwrap();
        }

        pub fn initiate_transfer(
            env: Env,
            role: Symbol,
            from: Address,
            to: Address,
            caller: Address,
        ) {
            initiate_role_transfer(&env, role, from, to, caller).unwrap();
        }

        pub fn accept_transfer(env: Env, role: Symbol, from: Address, caller: Address) {
            accept_role_transfer(&env, role, from, caller).unwrap();
        }

        pub fn reject_transfer(env: Env, role: Symbol, from: Address, caller: Address) {
            reject_role_transfer(&env, role, from, caller).unwrap();
        }

        pub fn pause(env: Env, caller: Address) {
            activate_emergency_pause(&env, caller).unwrap();
        }

        pub fn unpause(env: Env, caller: Address) {
            deactivate_emergency_pause(&env, caller).unwrap();
        }

        pub fn is_paused(env: Env) -> bool {
            is_emergency_paused(&env)
        }

        pub fn check_not_paused(env: Env) {
            require_not_paused(&env).unwrap();
        }
    }

    #[test]
    fn test_role_from_symbol() {
        let env = Env::default();
        let super_admin = Symbol::new(&env, "SUPER_ADMIN");
        let platform_admin = Symbol::new(&env, "PLATFORM_ADMIN");
        let contract_admin = Symbol::new(&env, "CONTRACT_ADMIN");
        let moderator = Symbol::new(&env, "MODERATOR");

        assert_eq!(
            Role::from_symbol(&env, &super_admin).unwrap(),
            Role::SuperAdmin
        );
        assert_eq!(
            Role::from_symbol(&env, &platform_admin).unwrap(),
            Role::PlatformAdmin
        );
        assert_eq!(
            Role::from_symbol(&env, &contract_admin).unwrap(),
            Role::ContractAdmin
        );
        assert_eq!(
            Role::from_symbol(&env, &moderator).unwrap(),
            Role::Moderator
        );
    }

    #[test]
    fn test_role_to_symbol() {
        let env = Env::default();
        let super_admin_sym = Role::SuperAdmin.to_symbol(&env);
        let platform_admin_sym = Role::PlatformAdmin.to_symbol(&env);
        let contract_admin_sym = Role::ContractAdmin.to_symbol(&env);
        let moderator_sym = Role::Moderator.to_symbol(&env);

        assert_eq!(super_admin_sym, Symbol::new(&env, "SUPER_ADMIN"));
        assert_eq!(platform_admin_sym, Symbol::new(&env, "PLATFORM_ADMIN"));
        assert_eq!(contract_admin_sym, Symbol::new(&env, "CONTRACT_ADMIN"));
        assert_eq!(moderator_sym, Symbol::new(&env, "MODERATOR"));
    }

    #[test]
    fn test_init_access_control() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let admin = Address::generate(&env);

        test.init(&admin);
        assert!(test.check_role(&Symbol::new(&env, "SUPER_ADMIN"), &admin));
    }

    #[test]
    fn test_grant_role() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        test.init(&admin);

        let moderator_role = Symbol::new(&env, "MODERATOR");
        test.grant(&moderator_role, &user, &admin);
        assert!(test.check_role(&moderator_role, &user));
    }

    #[test]
    fn test_revoke_role() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        test.init(&admin);

        let moderator_role = Symbol::new(&env, "MODERATOR");
        test.grant(&moderator_role, &user, &admin);
        assert!(test.check_role(&moderator_role, &user));

        test.revoke(&moderator_role, &user, &admin);
        assert!(!test.check_role(&moderator_role, &user));
    }

    #[test]
    fn test_require_role_success() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let admin = Address::generate(&env);

        test.init(&admin);

        let super_admin_role = Symbol::new(&env, "SUPER_ADMIN");
        test.require(&super_admin_role, &admin);
    }

    #[test]
    #[should_panic(expected = "InvalidAction")]
    fn test_require_role_failure() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let user = Address::generate(&env);

        let super_admin_role = Symbol::new(&env, "SUPER_ADMIN");
        test.require(&super_admin_role, &user);
    }

    #[test]
    fn test_initiate_role_transfer() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let admin = Address::generate(&env);
        let new_admin = Address::generate(&env);

        test.init(&admin);

        let super_admin_role = Symbol::new(&env, "SUPER_ADMIN");
        test.initiate_transfer(&super_admin_role, &admin, &new_admin, &admin);
    }

    #[test]
    fn test_accept_role_transfer() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let admin = Address::generate(&env);
        let new_admin = Address::generate(&env);

        test.init(&admin);

        let super_admin_role = Symbol::new(&env, "SUPER_ADMIN");
        test.initiate_transfer(&super_admin_role, &admin, &new_admin, &admin);

        assert!(test.check_role(&super_admin_role, &admin));
        test.accept_transfer(&super_admin_role, &admin, &new_admin);
        assert!(!test.check_role(&super_admin_role, &admin));
        assert!(test.check_role(&super_admin_role, &new_admin));
    }

    #[test]
    fn test_reject_role_transfer() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let admin = Address::generate(&env);
        let new_admin = Address::generate(&env);

        test.init(&admin);

        let super_admin_role = Symbol::new(&env, "SUPER_ADMIN");
        test.initiate_transfer(&super_admin_role, &admin, &new_admin, &admin);

        test.reject_transfer(&super_admin_role, &admin, &new_admin);
        assert!(test.check_role(&super_admin_role, &admin));
    }

    #[test]
    fn test_emergency_pause() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let admin = Address::generate(&env);

        test.init(&admin);

        assert!(!test.is_paused());
        test.pause(&admin);
        assert!(test.is_paused());
        test.unpause(&admin);
        assert!(!test.is_paused());
    }

    #[test]
    fn test_require_not_paused() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let admin = Address::generate(&env);

        test.init(&admin);

        test.check_not_paused();
        test.pause(&admin);
        // Should panic when paused
    }

    #[test]
    #[should_panic(expected = "InvalidAction")]
    fn test_require_not_paused_panics() {
        let env = Env::default();
        let test_id = env.register(AccessControlTest, ());
        let test = AccessControlTestClient::new(&env, &test_id);
        let admin = Address::generate(&env);

        test.init(&admin);
        test.pause(&admin);
        test.check_not_paused();
    }
}
