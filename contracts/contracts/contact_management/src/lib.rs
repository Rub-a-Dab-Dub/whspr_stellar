#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, Vec,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ContactStatus {
    Contact = 0,
    Blocked = 1,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    ContactRecord(Address, Address),
    ContactList(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    InvalidTarget = 1,
    ContactNotFound = 2,
    AlreadyBlocked = 3,
    NotBlocked = 4,
    BlockedRelationship = 5,
}

#[contract]
pub struct ContactManagementContract;

#[contractimpl]
impl ContactManagementContract {
    pub fn add_contact(env: Env, owner: Address, contact: Address) -> Result<(), ContractError> {
        owner.require_auth();

        if owner == contact {
            return Err(ContractError::InvalidTarget);
        }

        if Self::is_blocked_pair(&env, owner.clone(), contact.clone()) {
            return Err(ContractError::BlockedRelationship);
        }

        env.storage().persistent().set(
            &DataKey::ContactRecord(owner.clone(), contact.clone()),
            &ContactStatus::Contact,
        );

        Self::append_unique_contact(&env, owner.clone(), contact.clone());

        env.events().publish(
            (symbol_short!("cont_add"), owner, contact),
            env.ledger().timestamp(),
        );

        Ok(())
    }

    pub fn remove_contact(env: Env, owner: Address, contact: Address) -> Result<(), ContractError> {
        owner.require_auth();

        if owner == contact {
            return Err(ContractError::InvalidTarget);
        }

        let key = DataKey::ContactRecord(owner.clone(), contact.clone());
        if !env.storage().persistent().has(&key) {
            return Err(ContractError::ContactNotFound);
        }

        env.storage().persistent().remove(&key);
        Self::remove_contact_from_list(&env, owner.clone(), contact.clone());

        env.events().publish(
            (symbol_short!("cont_rem"), owner, contact),
            env.ledger().timestamp(),
        );

        Ok(())
    }

    pub fn block_user(env: Env, owner: Address, user: Address) -> Result<(), ContractError> {
        owner.require_auth();

        if owner == user {
            return Err(ContractError::InvalidTarget);
        }

        let key = DataKey::ContactRecord(owner.clone(), user.clone());
        if let Some(status) = env.storage().persistent().get::<_, ContactStatus>(&key) {
            if status == ContactStatus::Blocked {
                return Err(ContractError::AlreadyBlocked);
            }
        }

        env.storage().persistent().set(&key, &ContactStatus::Blocked);

        // Hide both directions in contact views once a block is active.
        Self::remove_contact_from_list(&env, owner.clone(), user.clone());
        Self::remove_contact_from_list(&env, user.clone(), owner.clone());

        env.events().publish(
            (symbol_short!("usr_blk"), owner, user),
            env.ledger().timestamp(),
        );

        Ok(())
    }

    pub fn unblock_user(env: Env, owner: Address, user: Address) -> Result<(), ContractError> {
        owner.require_auth();

        if owner == user {
            return Err(ContractError::InvalidTarget);
        }

        let key = DataKey::ContactRecord(owner.clone(), user.clone());
        let status = env.storage().persistent().get::<_, ContactStatus>(&key);
        if status != Some(ContactStatus::Blocked) {
            return Err(ContractError::NotBlocked);
        }

        env.storage().persistent().remove(&key);

        env.events().publish(
            (symbol_short!("usr_unblk"), owner, user),
            env.ledger().timestamp(),
        );

        Ok(())
    }

    pub fn get_contacts(env: Env, address: Address) -> Vec<Address> {
        address.require_auth();

        let contacts: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::ContactList(address))
            .unwrap_or(Vec::new(&env));

        contacts
    }

    pub fn is_blocked(env: Env, user_a: Address, user_b: Address) -> bool {
        user_a.require_auth();
        Self::is_blocked_pair(&env, user_a, user_b)
    }

    fn is_blocked_pair(env: &Env, user_a: Address, user_b: Address) -> bool {
        let a_to_b = env
            .storage()
            .persistent()
            .get::<_, ContactStatus>(&DataKey::ContactRecord(user_a.clone(), user_b.clone()));
        let b_to_a = env
            .storage()
            .persistent()
            .get::<_, ContactStatus>(&DataKey::ContactRecord(user_b, user_a));

        a_to_b == Some(ContactStatus::Blocked) || b_to_a == Some(ContactStatus::Blocked)
    }

    fn append_unique_contact(env: &Env, owner: Address, contact: Address) {
        let key = DataKey::ContactList(owner);
        let mut contacts: Vec<Address> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));

        if !contacts.contains(&contact) {
            contacts.push_back(contact);
            env.storage().persistent().set(&key, &contacts);
        }
    }

    fn remove_contact_from_list(env: &Env, owner: Address, contact: Address) {
        let key = DataKey::ContactList(owner);
        let contacts: Vec<Address> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));

        let mut filtered = Vec::new(env);
        for current in contacts.iter() {
            if current != contact {
                filtered.push_back(current);
            }
        }

        env.storage().persistent().set(&key, &filtered);
    }
}

#[cfg(test)]
mod test;
