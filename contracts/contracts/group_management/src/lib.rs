#![no_std]

mod storage;
mod types;
mod events;
mod test;

use soroban_sdk::{contract, contractimpl, Address, Env, Symbol, Vec};
use types::{GroupRecord, MemberRecord, Role, GroupId, generate_group_id};
use storage::{
    save_group, get_group,
    save_member, get_member, remove_member_storage,
    get_group_members_list, add_member_to_list, remove_member_from_list,
    increment_group_counter
};
use events::{
    emit_group_created, emit_member_added, emit_member_removed,
    emit_role_assigned, emit_group_dissolved, emit_admin_transferred
};

#[contract]
pub struct GroupManagementContract;

#[contractimpl]
impl GroupManagementContract {
    /// Create a new group
    /// Returns the unique GroupId
    pub fn create_group(
        env: Env,
        creator: Address,
        name: Symbol,
        max_members: u32,
    ) -> GroupId {
        creator.require_auth();

        // Validate inputs
        if max_members == 0 || max_members > 10000 {
            panic!("Invalid max_members: must be between 1 and 10000");
        }

        // Generate unique group ID
        let counter = increment_group_counter(&env);
        let group_id = generate_group_id(&env, counter);

        // Create group record
        let group = GroupRecord {
            id: group_id.clone(),
            name: name.clone(),
            creator: creator.clone(),
            admin: creator.clone(),
            max_members,
            member_count: 1,
            created_at: env.ledger().timestamp(),
            is_active: true,
        };

        save_group(&env, &group_id, &group);

        // Add creator as admin member
        let creator_member = MemberRecord {
            address: creator.clone(),
            role: Role::Admin,
            joined_at: env.ledger().timestamp(),
        };

        save_member(&env, &group_id, &creator, &creator_member);
        add_member_to_list(&env, &group_id, &creator);

        // Emit event
        emit_group_created(&env, &group_id, &name, &creator, max_members);

        group_id
    }

    /// Add a member to a group
    pub fn add_member(
        env: Env,
        caller: Address,
        group_id: GroupId,
        member: Address,
    ) {
        caller.require_auth();

        // Get group and verify it exists and is active
        let mut group = get_group(&env, &group_id)
            .unwrap_or_else(|| panic!("Group not found"));

        if !group.is_active {
            panic!("Group is not active");
        }

        // Verify caller has permission (admin or moderator)
        Self::require_role(&env, &group_id, &caller, &[Role::Admin, Role::Moderator]);

        // Check if member already exists
        if get_member(&env, &group_id, &member).is_some() {
            panic!("Member already exists in group");
        }

        // Check max members limit
        if group.member_count >= group.max_members {
            panic!("Group has reached maximum member capacity");
        }

        // Add member with default role
        let new_member = MemberRecord {
            address: member.clone(),
            role: Role::Member,
            joined_at: env.ledger().timestamp(),
        };

        save_member(&env, &group_id, &member, &new_member);
        add_member_to_list(&env, &group_id, &member);

        // Update member count
        group.member_count += 1;
        save_group(&env, &group_id, &group);

        // Emit event
        emit_member_added(&env, &group_id, &member, &caller);
    }

    /// Remove a member from a group
    pub fn remove_member(
        env: Env,
        caller: Address,
        group_id: GroupId,
        member: Address,
    ) {
        caller.require_auth();

        // Get group
        let mut group = get_group(&env, &group_id)
            .unwrap_or_else(|| panic!("Group not found"));

        if !group.is_active {
            panic!("Group is not active");
        }

        // Verify caller has permission
        Self::require_role(&env, &group_id, &caller, &[Role::Admin, Role::Moderator]);

        // Get member to remove
        let member_record = get_member(&env, &group_id, &member)
            .unwrap_or_else(|| panic!("Member not found in group"));

        // Cannot remove the admin unless they're removing themselves
        if member_record.role == Role::Admin && caller != member {
            panic!("Cannot remove admin from group");
        }

        // Moderators cannot remove other moderators or admins
        let caller_member = get_member(&env, &group_id, &caller)
            .unwrap_or_else(|| panic!("Caller not in group"));
        
        if caller_member.role == Role::Moderator && 
           (member_record.role == Role::Moderator || member_record.role == Role::Admin) &&
           caller != member {
            panic!("Moderators cannot remove other moderators or admins");
        }

        // Remove member
        remove_member_storage(&env, &group_id, &member);
        remove_member_from_list(&env, &group_id, &member);

        // Update member count
        group.member_count -= 1;
        save_group(&env, &group_id, &group);

        // Emit event
        emit_member_removed(&env, &group_id, &member, &caller);
    }

    /// Assign a role to a member
    pub fn assign_role(
        env: Env,
        caller: Address,
        group_id: GroupId,
        member: Address,
        role: Role,
    ) {
        caller.require_auth();

        // Get group
        let group = get_group(&env, &group_id)
            .unwrap_or_else(|| panic!("Group not found"));

        if !group.is_active {
            panic!("Group is not active");
        }

        // Only admin can assign roles
        Self::require_role(&env, &group_id, &caller, &[Role::Admin]);

        // Get member
        let mut member_record = get_member(&env, &group_id, &member)
            .unwrap_or_else(|| panic!("Member not found in group"));

        // Cannot change admin role (admin is permanent)
        if member_record.role == Role::Admin && role != Role::Admin {
            panic!("Cannot change admin role");
        }

        // Update role
        member_record.role = role.clone();
        save_member(&env, &group_id, &member, &member_record);

        // Emit event
        emit_role_assigned(&env, &group_id, &member, &role, &caller);
    }

    /// Get all members of a group
    pub fn get_group_members(env: Env, group_id: GroupId) -> Vec<Address> {
        get_group_members_list(&env, &group_id)
    }

    /// Get member details
    pub fn get_member_info(
        env: Env,
        group_id: GroupId,
        member: Address,
    ) -> Option<MemberRecord> {
        get_member(&env, &group_id, &member)
    }

    /// Get group details
    pub fn get_group_info(env: Env, group_id: GroupId) -> Option<GroupRecord> {
        get_group(&env, &group_id)
    }

    /// Dissolve a group and distribute any funds
    pub fn dissolve_group(
        env: Env,
        caller: Address,
        group_id: GroupId,
    ) {
        caller.require_auth();

        // Get group
        let mut group = get_group(&env, &group_id)
            .unwrap_or_else(|| panic!("Group not found"));

        // Only admin can dissolve
        Self::require_role(&env, &group_id, &caller, &[Role::Admin]);

        if !group.is_active {
            panic!("Group already dissolved");
        }

        // Mark as inactive
        group.is_active = false;
        save_group(&env, &group_id, &group);

        // Get all members for fund distribution
        let members = get_group_members_list(&env, &group_id);

        // Emit event
        emit_group_dissolved(&env, &group_id, &caller, members.len());

        // Note: Actual fund distribution would require token contract integration
        // This is a placeholder for the dissolution logic
    }

    /// Transfer admin role to another member
    pub fn transfer_admin(
        env: Env,
        caller: Address,
        group_id: GroupId,
        new_admin: Address,
    ) {
        caller.require_auth();

        // Get group
        let mut group = get_group(&env, &group_id)
            .unwrap_or_else(|| panic!("Group not found"));

        if !group.is_active {
            panic!("Group is not active");
        }

        // Only current admin can transfer
        Self::require_role(&env, &group_id, &caller, &[Role::Admin]);

        // Verify new admin is a member
        let mut new_admin_record = get_member(&env, &group_id, &new_admin)
            .unwrap_or_else(|| panic!("New admin must be a member of the group"));

        // Update old admin to moderator
        let mut old_admin_record = get_member(&env, &group_id, &caller)
            .unwrap_or_else(|| panic!("Current admin not found"));
        old_admin_record.role = Role::Moderator;
        save_member(&env, &group_id, &caller, &old_admin_record);

        // Update new admin
        new_admin_record.role = Role::Admin;
        save_member(&env, &group_id, &new_admin, &new_admin_record);

        // Update group admin
        group.admin = new_admin.clone();
        save_group(&env, &group_id, &group);

        // Emit event
        emit_admin_transferred(&env, &group_id, &caller, &new_admin);
    }

    /// Helper function to check if caller has required role
    fn require_role(env: &Env, group_id: &GroupId, caller: &Address, allowed_roles: &[Role]) {
        let member = get_member(env, group_id, caller)
            .unwrap_or_else(|| panic!("Caller is not a member of the group"));

        if !allowed_roles.contains(&member.role) {
            panic!("Insufficient permissions");
        }
    }
}
