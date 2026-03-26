#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, symbol_short};
use crate::types::Role;

fn create_test_contract(env: &Env) -> (Address, GroupManagementContractClient) {
    let contract_id = env.register(GroupManagementContract, ());
    let client = GroupManagementContractClient::new(env, &contract_id);
    (contract_id, client)
}

#[test]
fn test_create_group() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_name = symbol_short!("TestGrp");
    let max_members = 100;

    let group_id = client.create_group(&creator, &group_name, &max_members);

    // Verify group was created
    let group_info = client.get_group_info(&group_id).unwrap();
    assert_eq!(group_info.name, group_name);
    assert_eq!(group_info.creator, creator);
    assert_eq!(group_info.admin, creator);
    assert_eq!(group_info.max_members, max_members);
    assert_eq!(group_info.member_count, 1);
    assert!(group_info.is_active);

    // Verify creator is a member with admin role
    let member_info = client.get_member_info(&group_id, &creator).unwrap();
    assert_eq!(member_info.role, Role::Admin);
    assert_eq!(member_info.address, creator);

    // Verify members list
    let members = client.get_group_members(&group_id);
    assert_eq!(members.len(), 1);
    assert_eq!(members.get(0).unwrap(), creator);
}

#[test]
#[should_panic(expected = "Invalid max_members")]
fn test_create_group_invalid_max_members() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    client.create_group(&creator, &symbol_short!("Test"), &0);
}

#[test]
fn test_add_member() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let new_member = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    // Create group
    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);

    // Add member
    client.add_member(&admin, &group_id, &new_member);

    // Verify member was added
    let member_info = client.get_member_info(&group_id, &new_member).unwrap();
    assert_eq!(member_info.role, Role::Member);
    assert_eq!(member_info.address, new_member);

    // Verify member count updated
    let group_info = client.get_group_info(&group_id).unwrap();
    assert_eq!(group_info.member_count, 2);

    // Verify members list
    let members = client.get_group_members(&group_id);
    assert_eq!(members.len(), 2);
}

#[test]
#[should_panic(expected = "Member already exists")]
fn test_add_duplicate_member() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &member);
    client.add_member(&admin, &group_id, &member); // Should panic
}

#[test]
#[should_panic(expected = "Insufficient permissions")]
fn test_add_member_without_permission() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &member);
    
    // Member tries to add another member (should fail)
    let new_member = Address::generate(&env);
    client.add_member(&member, &group_id, &new_member);
}

#[test]
#[should_panic(expected = "Group has reached maximum member capacity")]
fn test_add_member_exceeds_max() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    // Create group with max 2 members
    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &2);

    // Add one member (total = 2)
    let member1 = Address::generate(&env);
    client.add_member(&admin, &group_id, &member1);

    // Try to add another (should fail)
    let member2 = Address::generate(&env);
    client.add_member(&admin, &group_id, &member2);
}

#[test]
fn test_remove_member() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &member);

    // Remove member
    client.remove_member(&admin, &group_id, &member);

    // Verify member was removed
    assert!(client.get_member_info(&group_id, &member).is_none());

    // Verify member count updated
    let group_info = client.get_group_info(&group_id).unwrap();
    assert_eq!(group_info.member_count, 1);

    // Verify members list
    let members = client.get_group_members(&group_id);
    assert_eq!(members.len(), 1);
}

#[test]
#[should_panic(expected = "Cannot remove admin")]
fn test_remove_admin_by_moderator() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let moderator = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &moderator);
    client.assign_role(&admin, &group_id, &moderator, &Role::Moderator);

    // Moderator tries to remove admin (should fail)
    client.remove_member(&moderator, &group_id, &admin);
}

#[test]
fn test_admin_can_remove_self() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);

    // Admin removes themselves
    client.remove_member(&admin, &group_id, &admin);

    // Verify admin was removed
    assert!(client.get_member_info(&group_id, &admin).is_none());
}

#[test]
fn test_assign_role() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &member);

    // Assign moderator role
    client.assign_role(&admin, &group_id, &member, &Role::Moderator);

    // Verify role was assigned
    let member_info = client.get_member_info(&group_id, &member).unwrap();
    assert_eq!(member_info.role, Role::Moderator);
}

#[test]
#[should_panic(expected = "Insufficient permissions")]
fn test_assign_role_without_permission() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member1 = Address::generate(&env);
    let member2 = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &member1);
    client.add_member(&admin, &group_id, &member2);

    // Member tries to assign role (should fail)
    client.assign_role(&member1, &group_id, &member2, &Role::Moderator);
}

#[test]
#[should_panic(expected = "Cannot change admin role")]
fn test_cannot_change_admin_role() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);

    // Try to change admin role (should fail)
    client.assign_role(&admin, &group_id, &admin, &Role::Member);
}

#[test]
fn test_moderator_can_add_members() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let moderator = Address::generate(&env);
    let new_member = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &moderator);
    client.assign_role(&admin, &group_id, &moderator, &Role::Moderator);

    // Moderator adds a member
    client.add_member(&moderator, &group_id, &new_member);

    // Verify member was added
    let member_info = client.get_member_info(&group_id, &new_member).unwrap();
    assert_eq!(member_info.role, Role::Member);
}

#[test]
#[should_panic(expected = "Moderators cannot remove other moderators")]
fn test_moderator_cannot_remove_moderator() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let moderator1 = Address::generate(&env);
    let moderator2 = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &moderator1);
    client.add_member(&admin, &group_id, &moderator2);
    client.assign_role(&admin, &group_id, &moderator1, &Role::Moderator);
    client.assign_role(&admin, &group_id, &moderator2, &Role::Moderator);

    // Moderator tries to remove another moderator (should fail)
    client.remove_member(&moderator1, &group_id, &moderator2);
}

#[test]
fn test_dissolve_group() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &member);

    // Dissolve group
    client.dissolve_group(&admin, &group_id);

    // Verify group is inactive
    let group_info = client.get_group_info(&group_id).unwrap();
    assert!(!group_info.is_active);
}

#[test]
#[should_panic(expected = "Insufficient permissions")]
fn test_dissolve_group_without_permission() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &member);

    // Member tries to dissolve (should fail)
    client.dissolve_group(&member, &group_id);
}

#[test]
#[should_panic(expected = "Group is not active")]
fn test_cannot_add_to_dissolved_group() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.dissolve_group(&admin, &group_id);

    // Try to add member to dissolved group (should fail)
    client.add_member(&admin, &group_id, &member);
}

#[test]
fn test_transfer_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);
    client.add_member(&admin, &group_id, &new_admin);

    // Transfer admin
    client.transfer_admin(&admin, &group_id, &new_admin);

    // Verify new admin
    let group_info = client.get_group_info(&group_id).unwrap();
    assert_eq!(group_info.admin, new_admin);

    let new_admin_info = client.get_member_info(&group_id, &new_admin).unwrap();
    assert_eq!(new_admin_info.role, Role::Admin);

    // Verify old admin is now moderator
    let old_admin_info = client.get_member_info(&group_id, &admin).unwrap();
    assert_eq!(old_admin_info.role, Role::Moderator);
}

#[test]
#[should_panic(expected = "New admin must be a member")]
fn test_transfer_admin_to_non_member() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let non_member = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &100);

    // Try to transfer to non-member (should fail)
    client.transfer_admin(&admin, &group_id, &non_member);
}

#[test]
fn test_complex_group_workflow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let mod1 = Address::generate(&env);
    let mod2 = Address::generate(&env);
    let member1 = Address::generate(&env);
    let member2 = Address::generate(&env);
    let member3 = Address::generate(&env);
    let (_, client) = create_test_contract(&env);

    // Create group
    let group_id = client.create_group(&admin, &symbol_short!("TestGrp"), &10);

    // Add moderators
    client.add_member(&admin, &group_id, &mod1);
    client.add_member(&admin, &group_id, &mod2);
    client.assign_role(&admin, &group_id, &mod1, &Role::Moderator);
    client.assign_role(&admin, &group_id, &mod2, &Role::Moderator);

    // Moderators add members
    client.add_member(&mod1, &group_id, &member1);
    client.add_member(&mod2, &group_id, &member2);
    client.add_member(&mod1, &group_id, &member3);

    // Verify member count
    let group_info = client.get_group_info(&group_id).unwrap();
    assert_eq!(group_info.member_count, 6);

    // Verify all members
    let members = client.get_group_members(&group_id);
    assert_eq!(members.len(), 6);

    // Remove a member
    client.remove_member(&mod1, &group_id, &member3);

    // Verify updated count
    let group_info = client.get_group_info(&group_id).unwrap();
    assert_eq!(group_info.member_count, 5);
}
