#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, symbol_short};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Message {
    pub sender: Address,
    pub content: String,
    pub timestamp: u64,
    pub room_id: u64,
}

#[contracttype]
pub enum DataKey {
    Messages(u64),   // room_id -> Vec<Message>
    RoomCount,
    RoomOwner(u64),  // room_id -> Address
    UserXP(Address), // address -> u64
}

const XP_SEND_MESSAGE: u64 = 10;
const XP_CREATE_ROOM: u64 = 50;
const XP_TIP_USER: u64 = 20;
const XP_PER_LEVEL: u64 = 1000;

#[contract]
pub struct MessagingContract;

#[contractimpl]
impl MessagingContract {
    /// Create a new chat room. Returns the new room_id.
    pub fn create_room(env: Env, owner: Address) -> u64 {
        owner.require_auth();

        let room_count: u64 = env.storage().instance().get(&DataKey::RoomCount).unwrap_or(0);
        let room_id = room_count + 1;

        env.storage().instance().set(&DataKey::RoomCount, &room_id);
        env.storage().instance().set(&DataKey::RoomOwner(room_id), &owner);
        env.storage().instance().set(&DataKey::Messages(room_id), &Vec::<Message>::new(&env));

        Self::add_xp(&env, owner, XP_CREATE_ROOM);

        env.events().publish((symbol_short!("room"), symbol_short!("created")), room_id);

        room_id
    }

    /// Send a message to a room.
    pub fn send_message(env: Env, sender: Address, room_id: u64, content: String) {
        sender.require_auth();

        let mut messages: Vec<Message> = env
            .storage()
            .instance()
            .get(&DataKey::Messages(room_id))
            .unwrap_or(Vec::new(&env));

        let msg = Message {
            sender: sender.clone(),
            content,
            timestamp: env.ledger().timestamp(),
            room_id,
        };

        messages.push_back(msg);
        env.storage().instance().set(&DataKey::Messages(room_id), &messages);

        Self::add_xp(&env, sender.clone(), XP_SEND_MESSAGE);

        env.events().publish((symbol_short!("msg"), symbol_short!("sent")), (room_id, sender));
    }

    /// Get all messages for a room.
    pub fn get_messages(env: Env, room_id: u64) -> Vec<Message> {
        env.storage()
            .instance()
            .get(&DataKey::Messages(room_id))
            .unwrap_or(Vec::new(&env))
    }

    /// Tip a user (XP reward for tipper).
    pub fn tip_user(env: Env, tipper: Address, _recipient: Address) {
        tipper.require_auth();
        Self::add_xp(&env, tipper.clone(), XP_TIP_USER);
        env.events().publish((symbol_short!("tip"), symbol_short!("sent")), tipper);
    }

    /// Get a user's XP.
    pub fn get_xp(env: Env, user: Address) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::UserXP(user))
            .unwrap_or(0)
    }

    /// Get a user's level (1000 XP per level).
    pub fn get_level(env: Env, user: Address) -> u64 {
        let xp = Self::get_xp(env, user);
        xp / XP_PER_LEVEL + 1
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    fn add_xp(env: &Env, user: Address, amount: u64) {
        let current: u64 = env
            .storage()
            .instance()
            .get(&DataKey::UserXP(user.clone()))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::UserXP(user), &(current + amount));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    #[test]
    fn test_create_room_and_send_message() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, MessagingContract);
        let client = MessagingContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let room_id = client.create_room(&owner);
        assert_eq!(room_id, 1);

        let sender = Address::generate(&env);
        client.send_message(&sender, &room_id, &String::from_str(&env, "Hello Stellar!"));

        let messages = client.get_messages(&room_id);
        assert_eq!(messages.len(), 1);

        let xp = client.get_xp(&sender);
        assert_eq!(xp, XP_SEND_MESSAGE);
    }

    #[test]
    fn test_levels() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, MessagingContract);
        let client = MessagingContractClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        let room_id = client.create_room(&user);

        for _ in 0..100 {
            client.send_message(&user, &room_id, &String::from_str(&env, "msg"));
        }

        // 50 (create room) + 100*10 (messages) = 1050 XP → level 2
        let level = client.get_level(&user);
        assert_eq!(level, 2);
    }
}
