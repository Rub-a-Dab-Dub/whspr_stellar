#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Vec, symbol_short};

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
    PlatformAddress, // recipient of platform fees
}

const XP_SEND_MESSAGE: u64 = 10;
const XP_CREATE_ROOM: u64 = 50;
const XP_TIP_USER: u64 = 20;
const XP_PER_LEVEL: u64 = 1000;

/// Platform fee taken from every tip, in basis points (200 = 2%).
const PLATFORM_FEE_BPS: i128 = 200;
const BPS_DENOMINATOR: i128 = 10_000;

#[contract]
pub struct MessagingContract;

#[contractimpl]
impl MessagingContract {
    /// One-time setup: sets the address that receives the 2% platform fee
    /// on tips. Must be called before `tip_user`.
    ///
    /// Requires `platform_address` to authorize the call, so no one can set
    /// an address they don't control as the fee recipient. This does *not*
    /// fully close the front-running window on a freshly deployed contract
    /// (the platform's own address could still race someone else's), so the
    /// deploy script should call `initialize` immediately after deployment,
    /// ideally as part of the same submitted transaction batch.
    pub fn initialize(env: Env, platform_address: Address) {
        platform_address.require_auth();

        if env.storage().instance().has(&DataKey::PlatformAddress) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::PlatformAddress, &platform_address);
    }

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

    /// Tip a user in `token`. Transfers `amount` from `tipper`, sending a 2%
    /// platform fee to the configured platform address and the remainder to
    /// `recipient`. Awards the tipper XP. Returns `(payout, fee)`.
    pub fn tip_user(env: Env, tipper: Address, recipient: Address, token: Address, amount: i128) -> (i128, i128) {
        tipper.require_auth();
        assert!(amount > 0, "tip amount must be positive");

        let platform_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::PlatformAddress)
            .expect("contract not initialized: call initialize() first");

        let fee = (amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        let payout = amount - fee;

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&tipper, &recipient, &payout);
        if fee > 0 {
            token_client.transfer(&tipper, &platform_address, &fee);
        }

        Self::add_xp(&env, tipper.clone(), XP_TIP_USER);

        env.events().publish(
            (symbol_short!("tip"), symbol_short!("sent")),
            (tipper, recipient, amount, fee),
        );

        (payout, fee)
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

    #[test]
    fn test_tip_user_splits_platform_fee() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, MessagingContract);
        let client = MessagingContractClient::new(&env, &contract_id);

        let platform = Address::generate(&env);
        client.initialize(&platform);

        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_address = token_contract.address();
        let token_asset_client = token::StellarAssetClient::new(&env, &token_address);
        let token_client = token::Client::new(&env, &token_address);

        let tipper = Address::generate(&env);
        let recipient = Address::generate(&env);
        token_asset_client.mint(&tipper, &1_000);

        let (payout, fee) = client.tip_user(&tipper, &recipient, &token_address, &1_000);

        // 2% of 1000 = 20 fee, 980 payout
        assert_eq!(fee, 20);
        assert_eq!(payout, 980);
        assert_eq!(token_client.balance(&recipient), 980);
        assert_eq!(token_client.balance(&platform), 20);
        assert_eq!(token_client.balance(&tipper), 0);

        let xp = client.get_xp(&tipper);
        assert_eq!(xp, XP_TIP_USER);
    }

    #[test]
    #[should_panic(expected = "contract not initialized")]
    fn test_tip_user_requires_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, MessagingContract);
        let client = MessagingContractClient::new(&env, &contract_id);

        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin);
        let token_address = token_contract.address();

        let tipper = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.tip_user(&tipper, &recipient, &token_address, &100);
    }

    #[test]
    #[should_panic]
    fn test_initialize_requires_platform_address_auth() {
        let env = Env::default();
        // Deliberately no mock_all_auths(): the platform address never
        // authorized this call, so initialize() must reject it.

        let contract_id = env.register_contract(None, MessagingContract);
        let client = MessagingContractClient::new(&env, &contract_id);

        let platform = Address::generate(&env);
        client.initialize(&platform);
    }
}
