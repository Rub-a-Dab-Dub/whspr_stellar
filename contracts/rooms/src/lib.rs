#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Bytes, Env};

const FEE_BPS: i128 = 200;
const BPS_DENOM: i128 = 10_000;

#[contracttype]
#[derive(Clone)]
pub struct Room {
    pub creator: Address,
    pub entry_fee: i128,
    pub token: Option<Address>,
    pub expires_at: Option<u64>,
    pub active: bool,
}

#[contracttype]
pub enum DataKey {
    Room(Bytes),
    Member(Bytes, Address),
    Platform,
}

#[contract]
pub struct RoomsContract;

#[contractimpl]
impl RoomsContract {
    pub fn initialize(env: Env, platform: Address) {
        if env.storage().instance().has(&DataKey::Platform) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Platform, &platform);
    }

    /// Create a room. Returns XP awarded (50).
    pub fn create_room(
        env: Env,
        creator: Address,
        room_id: Bytes,
        entry_fee: i128,
        token: Option<Address>,
        expires_at: Option<u64>,
    ) -> i128 {
        creator.require_auth();

        if env
            .storage()
            .persistent()
            .has(&DataKey::Room(room_id.clone()))
        {
            panic!("room exists");
        }
        if entry_fee < 0 {
            panic!("entry_fee cannot be negative");
        }
        if entry_fee > 0 && token.is_none() {
            panic!("token required for paid room");
        }

        let room = Room {
            creator: creator.clone(),
            entry_fee,
            token,
            expires_at,
            active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Room(room_id.clone()), &room);

        env.events().publish(
            (symbol_short!("room_crt"), creator),
            (room_id, entry_fee, expires_at),
        );

        50 // XP
    }

    /// Join a room, paying entry fee if set. Returns XP (0 — joining gives no XP).
    pub fn join_room(env: Env, member: Address, room_id: Bytes) {
        member.require_auth();

        let room: Room = env
            .storage()
            .persistent()
            .get(&DataKey::Room(room_id.clone()))
            .expect("room not found");

        if !room.active {
            panic!("room inactive");
        }
        if let Some(exp) = room.expires_at {
            if env.ledger().timestamp() >= exp {
                panic!("room expired");
            }
        }

        let mem_key = DataKey::Member(room_id.clone(), member.clone());
        if env.storage().persistent().has(&mem_key) {
            panic!("already a member");
        }

        if room.entry_fee > 0 {
            let platform: Address = env
                .storage()
                .instance()
                .get(&DataKey::Platform)
                .expect("not initialized");

            let fee = room.entry_fee * FEE_BPS / BPS_DENOM;
            let creator_share = room.entry_fee - fee;
            let token_id = room.token.clone().unwrap();
            let client = token::Client::new(&env, &token_id);
            client.transfer(&member, &room.creator, &creator_share);
            if fee > 0 {
                client.transfer(&member, &platform, &fee);
            }
        }

        env.storage().persistent().set(&mem_key, &true);

        env.events()
            .publish((symbol_short!("room_jnd"), room_id, member), room.entry_fee);
    }

    /// Expire a timed room (callable by anyone once past expiry).
    pub fn expire_room(env: Env, room_id: Bytes) {
        let key = DataKey::Room(room_id.clone());
        let mut room: Room = env
            .storage()
            .persistent()
            .get(&key)
            .expect("room not found");

        let exp = room.expires_at.expect("room has no expiry");
        if env.ledger().timestamp() < exp {
            panic!("not yet expired");
        }
        if !room.active {
            panic!("already expired");
        }

        room.active = false;
        env.storage().persistent().set(&key, &room);

        env.events()
            .publish((symbol_short!("room_exp"), room_id), exp);
    }

    pub fn get_room(env: Env, room_id: Bytes) -> Option<Room> {
        env.storage().persistent().get(&DataKey::Room(room_id))
    }

    pub fn is_member(env: Env, room_id: Bytes, member: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Member(room_id, member))
    }
}

#[cfg(test)]
mod tests;
