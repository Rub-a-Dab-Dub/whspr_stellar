use soroban_sdk::{Address, Env, Symbol, Vec, symbol_short};
use crate::types::{GroupRecord, MemberRecord, GroupId};

// Storage keys
const GROUP_KEY: Symbol = symbol_short!("GROUP");
const MEMBER_KEY: Symbol = symbol_short!("MEMBER");
const MEMBERS_LIST_KEY: Symbol = symbol_short!("MEMLIST");
const COUNTER_KEY: Symbol = symbol_short!("COUNTER");

/// Save a group record
pub fn save_group(env: &Env, group_id: &GroupId, group: &GroupRecord) {
    let key = (GROUP_KEY, group_id.clone());
    env.storage().persistent().set(&key, group);
    env.storage().persistent().extend_ttl(&key, 100000, 100000);
}

/// Get a group record
pub fn get_group(env: &Env, group_id: &GroupId) -> Option<GroupRecord> {
    let key = (GROUP_KEY, group_id.clone());
    env.storage().persistent().get(&key)
}

/// Delete a group record
pub fn delete_group(env: &Env, group_id: &GroupId) {
    let key = (GROUP_KEY, group_id.clone());
    env.storage().persistent().remove(&key);
}

/// Save a member record
pub fn save_member(env: &Env, group_id: &GroupId, member: &Address, record: &MemberRecord) {
    let key = (MEMBER_KEY, group_id.clone(), member.clone());
    env.storage().persistent().set(&key, record);
    env.storage().persistent().extend_ttl(&key, 100000, 100000);
}

/// Get a member record
pub fn get_member(env: &Env, group_id: &GroupId, member: &Address) -> Option<MemberRecord> {
    let key = (MEMBER_KEY, group_id.clone(), member.clone());
    env.storage().persistent().get(&key)
}

/// Remove a member record
pub fn remove_member_storage(env: &Env, group_id: &GroupId, member: &Address) {
    let key = (MEMBER_KEY, group_id.clone(), member.clone());
    env.storage().persistent().remove(&key);
}

/// Get list of all members in a group
pub fn get_group_members_list(env: &Env, group_id: &GroupId) -> Vec<Address> {
    let key = (MEMBERS_LIST_KEY, group_id.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

/// Add a member to the members list
pub fn add_member_to_list(env: &Env, group_id: &GroupId, member: &Address) {
    let key = (MEMBERS_LIST_KEY, group_id.clone());
    let mut members = get_group_members_list(env, group_id);
    members.push_back(member.clone());
    env.storage().persistent().set(&key, &members);
    env.storage().persistent().extend_ttl(&key, 100000, 100000);
}

/// Remove a member from the members list
pub fn remove_member_from_list(env: &Env, group_id: &GroupId, member: &Address) {
    let key = (MEMBERS_LIST_KEY, group_id.clone());
    let members = get_group_members_list(env, group_id);
    let mut new_members = Vec::new(env);
    
    for m in members.iter() {
        if m != *member {
            new_members.push_back(m);
        }
    }
    
    env.storage().persistent().set(&key, &new_members);
    env.storage().persistent().extend_ttl(&key, 100000, 100000);
}

/// Increment and return the group counter
pub fn increment_group_counter(env: &Env) -> u64 {
    let counter = get_group_counter(env);
    let new_counter = counter + 1;
    env.storage().persistent().set(&COUNTER_KEY, &new_counter);
    env.storage().persistent().extend_ttl(&COUNTER_KEY, 100000, 100000);
    new_counter
}

/// Get the current group counter
pub fn get_group_counter(env: &Env) -> u64 {
    env.storage()
        .persistent()
        .get(&COUNTER_KEY)
        .unwrap_or(0)
}
