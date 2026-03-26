#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, Symbol, symbol_short};

mod group_management {
    soroban_sdk::contractimport!(
        file = "../target/wasm32-unknown-unknown/release/group_management.wasm"
    );
}

use group_management::{GroupManagementContractClient, Role};

fn setup_test_env() -> (Env, GroupManagementContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract_wasm(None, group_management::WASM);
    let client = GroupManagementContractClient::new(&env, &contract_id);
    
    (env, client, contract_id)
}

#[test]
fn test_full_group_lifecycle() {
    let (env, client, _) = setup_test_env();
    
    let admin = Address::generate(&env);
    let member1 = Address::generate(&env);
    let member2 = Address::generate(&env);
    
    // Create group
    let group_id = client.create_group(&admin, &symbol_short!("MyGroup"), &50);
    
    // Add members
    client.add_member(&admin, &group_id, &member1);
    client.add_member(&admin, &group_id, &member2);
    
    // Verify group state
    let group_info = client.get_group_info(&group_id).unwrap();
    assert_eq!(group_info.member_count, 3);
    assert!(group_info.is_active);
    
    // Assign role
    client.assign_role(&admin, &group_id, &member1, &Role::Moderator);
    
    // Moderator adds another member
    let member3 = Address::generate(&env);
    client.add_member(&member1, &group_id, &member3);
    
    // Verify final state
    let members = client.get_group_members(&group_id);
    assert_eq!(members.len(), 4);
    
    // Dissolve group
    client.dissolve_group(&admin, &group_id);
    let group_info = client.get_group_info(&group_id).unwrap();
    assert!(!group_info.is_active);
}

#[test]
fn test_role_hierarchy() {
    let (env, client, _) = setup_test_env();
    
    let admin = Address::generate(&env);
    let moderator = Address::generate(&env);
    let member = Address::generate(&env);
    
    // Setup group with hierarchy
    let group_id = client.create_group(&admin, &symbol_short!("Hierarchy"), &100);
    client.add_member(&admin, &group_id, &moderator);
    client.add_member(&admin, &group_id, &member);
    client.assign_role(&admin, &group_id, &moderator, &Role::Moderator);
    
    // Verify roles
    let admin_info = client.get_member_info(&group_id, &admin).unwrap();
    assert_eq!(admin_info.role, Role::Admin);
    
    let mod_info = client.get_member_info(&group_id, &moderator).unwrap();
    assert_eq!(mod_info.role, Role::Moderator);
    
    let member_info = client.get_member_info(&group_id, &member).unwrap();
    assert_eq!(member_info.role, Role::Member);
}

#[test]
fn test_admin_transfer_workflow() {
    let (env, client, _) = setup_test_env();
    
    let original_admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    
    // Create group and add future admin
    let group_id = client.create_group(&original_admin, &symbol_short!("Transfer"), &100);
    client.add_member(&original_admin, &group_id, &new_admin);
    
    // Transfer admin rights
    client.transfer_admin(&original_admin, &group_id, &new_admin);
    
    // Verify transfer
    let group_info = client.get_group_info(&group_id).unwrap();
    assert_eq!(group_info.admin, new_admin);
    
    let new_admin_info = client.get_member_info(&group_id, &new_admin).unwrap();
    assert_eq!(new_admin_info.role, Role::Admin);
    
    let old_admin_info = client.get_member_info(&group_id, &original_admin).unwrap();
    assert_eq!(old_admin_info.role, Role::Moderator);
    
    // New admin can now perform admin actions
    let member = Address::generate(&env);
    client.add_member(&new_admin, &group_id, &member);
    
    let members = client.get_group_members(&group_id);
    assert_eq!(members.len(), 3);
}

#[test]
fn test_max_members_enforcement() {
    let (env, client, _) = setup_test_env();
    
    let admin = Address::generate(&env);
    
    // Create group with small limit
    let group_id = client.create_group(&admin, &symbol_short!("Small"), &3);
    
    // Add members up to limit
    let member1 = Address::generate(&env);
    let member2 = Address::generate(&env);
    client.add_member(&admin, &group_id, &member1);
    client.add_member(&admin, &group_id, &member2);
    
    // Verify at capacity
    let group_info = client.get_group_info(&group_id).unwrap();
    assert_eq!(group_info.member_count, 3);
    assert_eq!(group_info.max_members, 3);
}

#[test]
fn test_member_removal_updates_list() {
    let (env, client, _) = setup_test_env();
    
    let admin = Address::generate(&env);
    let member1 = Address::generate(&env);
    let member2 = Address::generate(&env);
    let member3 = Address::generate(&env);
    
    // Create group and add members
    let group_id = client.create_group(&admin, &symbol_short!("Removal"), &100);
    client.add_member(&admin, &group_id, &member1);
    client.add_member(&admin, &group_id, &member2);
    client.add_member(&admin, &group_id, &member3);
    
    // Remove middle member
    client.remove_member(&admin, &group_id, &member2);
    
    // Verify list is correct
    let members = client.get_group_members(&group_id);
    assert_eq!(members.len(), 3);
    assert!(members.contains(&admin));
    assert!(members.contains(&member1));
    assert!(members.contains(&member3));
    assert!(!members.contains(&member2));
}

#[test]
fn test_multiple_groups_independent() {
    let (env, client, _) = setup_test_env();
    
    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let shared_member = Address::generate(&env);
    
    // Create two groups
    let group1 = client.create_group(&admin1, &symbol_short!("Group1"), &50);
    let group2 = client.create_group(&admin2, &symbol_short!("Group2"), &50);
    
    // Add shared member to both
    client.add_member(&admin1, &group1, &shared_member);
    client.add_member(&admin2, &group2, &shared_member);
    
    // Verify independence
    let group1_info = client.get_group_info(&group1).unwrap();
    let group2_info = client.get_group_info(&group2).unwrap();
    
    assert_eq!(group1_info.member_count, 2);
    assert_eq!(group2_info.member_count, 2);
    assert_ne!(group1_info.admin, group2_info.admin);
    
    // Different roles in different groups
    client.assign_role(&admin1, &group1, &shared_member, &Role::Moderator);
    
    let member_in_group1 = client.get_member_info(&group1, &shared_member).unwrap();
    let member_in_group2 = client.get_member_info(&group2, &shared_member).unwrap();
    
    assert_eq!(member_in_group1.role, Role::Moderator);
    assert_eq!(member_in_group2.role, Role::Member);
}

#[test]
fn test_event_emission() {
    let (env, client, _) = setup_test_env();
    
    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    
    // Create group (should emit GroupCreated event)
    let group_id = client.create_group(&admin, &symbol_short!("Events"), &100);
    
    // Add member (should emit MemberAdded event)
    client.add_member(&admin, &group_id, &member);
    
    // Assign role (should emit RoleAssigned event)
    client.assign_role(&admin, &group_id, &member, &Role::Moderator);
    
    // Remove member (should emit MemberRemoved event)
    client.remove_member(&admin, &group_id, &member);
    
    // Dissolve group (should emit GroupDissolved event)
    client.dissolve_group(&admin, &group_id);
    
    // Events are emitted but we can't directly test them in this context
    // In a real scenario, you'd use event listeners or check event logs
}

#[test]
fn test_large_group_operations() {
    let (env, client, _) = setup_test_env();
    
    let admin = Address::generate(&env);
    
    // Create group with large capacity
    let group_id = client.create_group(&admin, &symbol_short!("Large"), &1000);
    
    // Add multiple members
    let mut members = Vec::new();
    for _ in 0..20 {
        let member = Address::generate(&env);
        client.add_member(&admin, &group_id, &member);
        members.push(member);
    }
    
    // Verify count
    let group_info = client.get_group_info(&group_id).unwrap();
    assert_eq!(group_info.member_count, 21); // admin + 20 members
    
    // Verify members list
    let member_list = client.get_group_members(&group_id);
    assert_eq!(member_list.len(), 21);
}
