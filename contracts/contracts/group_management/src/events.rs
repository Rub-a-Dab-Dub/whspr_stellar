use soroban_sdk::{Address, Env, Symbol};
use crate::types::{GroupId, Role};

/// Emit group created event
pub fn emit_group_created(env: &Env, group_id: &GroupId, name: &Symbol, creator: &Address, max_members: u32) {
    env.events().publish(
        (Symbol::new(env, "group_created"), group_id),
        (name, creator, max_members)
    );
}

/// Emit member added event
pub fn emit_member_added(env: &Env, group_id: &GroupId, member: &Address, added_by: &Address) {
    env.events().publish(
        (Symbol::new(env, "member_added"), group_id),
        (member, added_by)
    );
}

/// Emit member removed event
pub fn emit_member_removed(env: &Env, group_id: &GroupId, member: &Address, removed_by: &Address) {
    env.events().publish(
        (Symbol::new(env, "member_removed"), group_id),
        (member, removed_by)
    );
}

/// Emit role assigned event
pub fn emit_role_assigned(env: &Env, group_id: &GroupId, member: &Address, role: &Role, assigned_by: &Address) {
    let role_val = match role {
        Role::Admin => 0u32,
        Role::Moderator => 1u32,
        Role::Member => 2u32,
    };
    env.events().publish(
        (Symbol::new(env, "role_assigned"), group_id),
        (member, role_val, assigned_by)
    );
}

/// Emit group dissolved event
pub fn emit_group_dissolved(env: &Env, group_id: &GroupId, dissolved_by: &Address, member_count: u32) {
    env.events().publish(
        (Symbol::new(env, "group_dissolved"), group_id),
        (dissolved_by, member_count)
    );
}

/// Emit admin transferred event
pub fn emit_admin_transferred(env: &Env, group_id: &GroupId, old_admin: &Address, new_admin: &Address) {
    env.events().publish(
        (Symbol::new(env, "admin_transferred"), group_id),
        (old_admin, new_admin)
    );
}
