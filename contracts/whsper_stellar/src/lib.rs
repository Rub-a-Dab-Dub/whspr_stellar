#![no_std]

mod ratelimit;
mod storage;
mod test;
mod types;

use soroban_sdk::{contract, contractimpl, token, Address, Env, Symbol, Vec};

pub use crate::storage::*;
pub use crate::types::*;

#[contract]
pub struct BaseContract;

// all this XP point are subject to change
const XP_MESSAGE: u64 = 1;
const XP_TIP_RECEIVED: u64 = 5;

const XP_COOLDOWN_SECONDS: u64 = 30;
const MAX_XP_PER_HOUR: u64 = 60;

#[contractimpl]
impl BaseContract {
    pub fn init(env: Env, admin: Address, name: Symbol, version: u32) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        admin.require_auth();

        let metadata = ContractMetadata { name, version };

        // Default Rate Limit Config
        let config = RateLimitConfig {
            message_cooldown: 60,   // 1 minute
            tip_cooldown: 300,      // 5 minutes
            transfer_cooldown: 600, // 10 minutes
            daily_message_limit: 100,
            daily_tip_limit: 50,
            daily_transfer_limit: 20,
        };

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Metadata, &metadata);
        env.storage()
            .instance()
            .set(&DataKey::RateLimitConfig, &config);

        // Initialize Treasury Keys
        env.storage().instance().set(&DataKey::Treasury, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesCollected, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesWithdrawn, &0i128);
        Ok(())
    }

    pub fn admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn metadata(env: Env) -> ContractMetadata {
        env.storage()
            .instance()
            .get(&DataKey::Metadata)
            .expect("not initialized")
    }

    // Admin Functions from Rate Limit
    pub fn set_config(env: Env, config: RateLimitConfig) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::RateLimitConfig, &config);
    }

    pub fn set_reputation(env: Env, user: Address, reputation: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::UserReputation(user), &reputation);
    }

    pub fn set_override(env: Env, user: Address, is_exempt: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::AdminOverride(user), &is_exempt);
    }

    // User Profile Functions
    pub fn get_user_profile(env: Env, user: Address) -> Result<UserProfile, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::User(user))
            .ok_or(ContractError::UserNotFound)
    }

    pub fn get_room(env: Env, room_id: Symbol) -> Result<Room, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Room(room_id))
            .ok_or(ContractError::RoomNotFound)
    }

    pub fn has_access(env: Env, user: Address, room_id: Symbol) -> bool {
        let key = DataKey::RoomMember(room_id, user);
        if let Some(member) = env.storage().instance().get::<_, RoomMember>(&key) {
            member.has_access
        } else {
            false
        }
    }

    pub fn get_creator_balance(env: Env, creator: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::CreatorBalance(creator))
            .unwrap_or(0)
    }

    pub fn create_room(
        env: Env,
        creator: Address,
        room_id: Symbol,
        entry_fee: i128,
    ) -> Result<(), ContractError> {
        creator.require_auth();

        if env
            .storage()
            .instance()
            .has(&DataKey::Room(room_id.clone()))
        {
            return Err(ContractError::RoomAlreadyExists);
        }

        let room = Room {
            id: room_id.clone(),
            creator: creator.clone(),
            entry_fee,
            is_cancelled: false,
            total_revenue: 0,
        };

        env.storage().instance().set(&DataKey::Room(room_id), &room);
        Ok(())
    }

    pub fn pay_entry_fee(env: Env, user: Address, room_id: Symbol) -> Result<(), ContractError> {
        user.require_auth();

        let mut room: Room = env
            .storage()
            .instance()
            .get(&DataKey::Room(room_id.clone()))
            .ok_or(ContractError::RoomNotFound)?;

        if room.is_cancelled {
            return Err(ContractError::RoomCancelled);
        }

        if Self::has_access(env.clone(), user.clone(), room_id.clone()) {
            return Err(ContractError::AccessAlreadyGranted);
        }

        let settings = Self::get_platform_settings(env.clone());
        let total_fee = room.entry_fee;

        // Transfer tokens from user to contract
        let token_client = token::Client::new(&env, &settings.fee_token);
        token_client.transfer(&user, &env.current_contract_address(), &total_fee);

        // Calculate platform fee
        let platform_fee = (total_fee * settings.fee_percentage as i128) / 10000;
        let creator_share = total_fee - platform_fee;

        // Update treasury (platform fee)
        let mut treasury_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap_or(0);
        treasury_balance += platform_fee;
        env.storage()
            .instance()
            .set(&DataKey::Treasury, &treasury_balance);

        let mut total_collected: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesCollected)
            .unwrap_or(0);
        total_collected += platform_fee;
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesCollected, &total_collected);

        // Update creator balance
        let mut creator_balance = Self::get_creator_balance(env.clone(), room.creator.clone());
        creator_balance += creator_share;
        env.storage().instance().set(
            &DataKey::CreatorBalance(room.creator.clone()),
            &creator_balance,
        );

        // Update room revenue
        room.total_revenue += total_fee;
        env.storage()
            .instance()
            .set(&DataKey::Room(room_id.clone()), &room);

        // Grant access
        let member = RoomMember {
            has_access: true,
            joined_at: env.ledger().timestamp(),
        };
        env.storage()
            .instance()
            .set(&DataKey::RoomMember(room_id, user), &member);

        Ok(())
    }

    pub fn cancel_room(env: Env, creator: Address, room_id: Symbol) -> Result<(), ContractError> {
        creator.require_auth();

        let mut room: Room = env
            .storage()
            .instance()
            .get(&DataKey::Room(room_id.clone()))
            .ok_or(ContractError::RoomNotFound)?;

        if room.creator != creator {
            return Err(ContractError::NotRoomCreator);
        }

        room.is_cancelled = true;
        env.storage().instance().set(&DataKey::Room(room_id), &room);
        Ok(())
    }

    pub fn refund_entry_fee(env: Env, user: Address, room_id: Symbol) -> Result<(), ContractError> {
        user.require_auth();

        let room: Room = env
            .storage()
            .instance()
            .get(&DataKey::Room(room_id.clone()))
            .ok_or(ContractError::RoomNotFound)?;

        if !room.is_cancelled {
            // Usually refunds are only for cancelled rooms in this design
            return Err(ContractError::Unauthorized);
        }

        let key = DataKey::RoomMember(room_id.clone(), user.clone());
        let mut member: RoomMember = env
            .storage()
            .instance()
            .get(&key)
            .ok_or(ContractError::UserNotFound)?;

        if !member.has_access {
            return Err(ContractError::Unauthorized);
        }

        let settings = Self::get_platform_settings(env.clone());
        let refund_amount = room.entry_fee;

        // Transfer tokens back to user
        let token_client = token::Client::new(&env, &settings.fee_token);
        token_client.transfer(&env.current_contract_address(), &user, &refund_amount);

        // Revoke access
        member.has_access = false;
        env.storage().instance().set(&key, &member);

        Ok(())
    }

    pub fn withdraw_creator_funds(
        env: Env,
        creator: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        creator.require_auth();

        let mut balance = Self::get_creator_balance(env.clone(), creator.clone());
        if amount > balance {
            return Err(ContractError::InsufficientFunds);
        }

        let settings = Self::get_platform_settings(env.clone());
        let token_client = token::Client::new(&env, &settings.fee_token);
        token_client.transfer(&env.current_contract_address(), &creator, &amount);

        balance -= amount;
        env.storage()
            .instance()
            .set(&DataKey::CreatorBalance(creator), &balance);

        Ok(())
    }

    pub fn register_user(env: Env, user: Address, username: Symbol) -> Result<(), ContractError> {
        user.require_auth();

        validate_username(username.clone())?;

        if env.storage().instance().has(&DataKey::User(user.clone())) {
            return Err(ContractError::UserAlreadyRegistered);
        }

        if env
            .storage()
            .instance()
            .has(&DataKey::Username(username.clone()))
        {
            return Err(ContractError::UsernameTaken);
        }

        let profile = UserProfile {
            address: user.clone(),
            username: username.clone(),
            xp: 0,
            level: 1,
            badges: Vec::new(&env),
            join_date: env.ledger().timestamp(),
        };

        env.storage()
            .instance()
            .set(&DataKey::User(user.clone()), &profile);
        env.storage()
            .instance()
            .set(&DataKey::Username(username), &user);

        Ok(())
    }

    pub fn update_username(
        env: Env,
        user: Address,
        new_username: Symbol,
    ) -> Result<(), ContractError> {
        user.require_auth();

        validate_username(new_username.clone())?;

        if env
            .storage()
            .instance()
            .has(&DataKey::Username(new_username.clone()))
        {
            return Err(ContractError::UsernameTaken);
        }

        let mut profile: UserProfile = env
            .storage()
            .instance()
            .get(&DataKey::User(user.clone()))
            .ok_or(ContractError::UserNotFound)?;

        env.storage()
            .instance()
            .remove(&DataKey::Username(profile.username.clone()));
        env.storage()
            .instance()
            .set(&DataKey::Username(new_username.clone()), &user);

        profile.username = new_username;

        env.storage().instance().set(&DataKey::User(user), &profile);

        Ok(())
    }

    pub fn add_xp(env: Env, user: Address, xp_amount: u64) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;

        admin.require_auth();

        let mut profile: UserProfile = env
            .storage()
            .instance()
            .get(&DataKey::User(user.clone()))
            .ok_or(ContractError::UserNotFound)?;

        profile.xp += xp_amount;
        profile.level = calculate_level(profile.xp);

        env.storage().instance().set(&DataKey::User(user), &profile);

        Ok(())
    }

    fn award_xp(
        env: &Env,
        user: Address,
        xp_amount: u64,
        action: ActionType,
    ) -> Result<(u32, u32), ContractError> {
        let now = env.ledger().timestamp();

        if let Some(last_ts) = env
            .storage()
            .instance()
            .get::<_, u64>(&DataKey::UserLastAction(user.clone(), action))
        {
            if now < last_ts + XP_COOLDOWN_SECONDS {
                return Err(ContractError::XpCooldownActive);
            }
        }
        let hour_bucket = now / 3600;

        let current_hour_xp: u64 = env
            .storage()
            .instance()
            .get(&DataKey::HourlyXp(user.clone(), hour_bucket))
            .unwrap_or(0);

        if current_hour_xp + xp_amount > MAX_XP_PER_HOUR {
            return Err(ContractError::XpRateLimited);
        }

        let mut profile: UserProfile = env
            .storage()
            .instance()
            .get(&DataKey::User(user.clone()))
            .unwrap_or(UserProfile {
                address: user.clone(),
                username: Symbol::new(env, "anonymous"),
                xp: 0,
                level: 1,
                badges: Vec::new(env),
                join_date: env.ledger().timestamp(),
            });

        let old_level = profile.level;

        profile.xp += xp_amount;
        profile.level = calculate_level(profile.xp);

        env.storage()
            .instance()
            .set(&DataKey::User(user.clone()), &profile);
        env.storage()
            .instance()
            .set(&DataKey::UserLastAction(user.clone(), action), &now);

        env.storage().instance().set(
            &DataKey::HourlyXp(user.clone(), hour_bucket),
            &(current_hour_xp + xp_amount),
        );

        Ok((old_level, profile.level))
    }

    fn emit_level_up(env: &Env, user: Address, old_level: u32, new_level: u32) {
        if new_level > old_level {
            env.events()
                .publish((Symbol::new(env, "level_up"), user), (old_level, new_level));
        }
    }

    pub fn send_message(env: Env, user: Address) -> Result<(), ContractError> {
        user.require_auth();
        check_can_act(&env, &user, ActionType::Message);
        record_action(&env, &user, ActionType::Message);
        Ok(())
    }

    pub fn reward_message(env: Env, user: Address) -> Result<(), ContractError> {
        ratelimit::check_can_act(&env, &user, ActionType::Message);

        let (old_level, new_level) =
            Self::award_xp(&env, user.clone(), XP_MESSAGE, ActionType::Message)?;

        Self::emit_level_up(&env, user, old_level, new_level);

        Ok(())
    }

    pub fn reward_tip_received(env: Env, user: Address) -> Result<(), ContractError> {
        require_admin(&env)?;
        let (old_level, new_level) =
            Self::award_xp(&env, user.clone(), XP_TIP_RECEIVED, ActionType::TipReceived)?;

        Self::emit_level_up(&env, user, old_level, new_level);

        Ok(())
    }

    // P2P Token Transfers (Zero Fees)
    pub fn transfer_tokens(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        // 1. Validate Access
        sender.require_auth();

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        // 2. Rate Limiting
        check_can_act(&env, &sender, ActionType::Transfer);

        // 3. Perform Token Transfer (0% Fee)
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &recipient, &amount);

        // 4. Record Action for Rate Limiting
        record_action(&env, &sender, ActionType::Transfer);

        // 5. Emit Event
        env.events().publish(
            (Symbol::new(&env, "transfer"), sender, recipient),
            (token, amount),
        );

        Ok(())
    }

    /// Initialize platform settings (must be called after init)
    pub fn init_platform_settings(env: Env, fee_percentage: u32, fee_token: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        if fee_percentage > 10000 {
            panic!("fee percentage cannot exceed 100%");
        }

        let settings = PlatformSettings {
            fee_percentage,
            admin_address: admin,
            fee_token,
        };

        env.storage()
            .instance()
            .set(&DataKey::PlatformSettings, &settings);
    }

    pub fn get_platform_settings(env: Env) -> PlatformSettings {
        env.storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .expect("platform settings not initialized")
    }

    pub fn update_fee_percentage(env: Env, new_fee_percentage: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        if new_fee_percentage > 10000 {
            panic!("fee percentage cannot exceed 100%");
        }

        let mut settings: PlatformSettings = env
            .storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .expect("platform settings not initialized");
        settings.fee_percentage = new_fee_percentage;
        env.storage()
            .instance()
            .set(&DataKey::PlatformSettings, &settings);
    }

    pub fn collect_fee(env: Env, amount: i128) {
        let settings: PlatformSettings = env
            .storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .expect("platform settings not initialized");
        let fee_amount = (amount * settings.fee_percentage as i128) / 10000;

        let mut treasury_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap_or(0);
        treasury_balance += fee_amount;
        env.storage()
            .instance()
            .set(&DataKey::Treasury, &treasury_balance);

        let mut total_collected: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesCollected)
            .unwrap_or(0);
        total_collected += fee_amount;
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesCollected, &total_collected);
    }

    pub fn withdraw_fees(env: Env, amount: i128, recipient: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        if amount <= 0 {
            panic!("withdrawal amount must be positive");
        }

        let mut treasury_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap_or(0);
        if amount > treasury_balance {
            panic!("insufficient treasury balance");
        }

        let settings: PlatformSettings = env
            .storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .expect("platform settings not initialized");
        let token_client = token::Client::new(&env, &settings.fee_token);
        token_client.transfer(&env.current_contract_address(), &recipient, &amount);

        treasury_balance -= amount;
        env.storage()
            .instance()
            .set(&DataKey::Treasury, &treasury_balance);

        let mut total_withdrawn: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesWithdrawn)
            .unwrap_or(0);
        total_withdrawn += amount;
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesWithdrawn, &total_withdrawn);
    }

    pub fn get_treasury_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap_or(0)
    }

    pub fn get_total_fees_collected(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalFeesCollected)
            .unwrap_or(0)
    }

    pub fn get_total_fees_withdrawn(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalFeesWithdrawn)
            .unwrap_or(0)
    }

    pub fn get_treasury_analytics(env: Env) -> TreasuryAnalytics {
        let settings: PlatformSettings = env
            .storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .expect("platform settings not initialized");
        TreasuryAnalytics {
            current_balance: env
                .storage()
                .instance()
                .get(&DataKey::Treasury)
                .unwrap_or(0),
            total_collected: env
                .storage()
                .instance()
                .get(&DataKey::TotalFeesCollected)
                .unwrap_or(0),
            total_withdrawn: env
                .storage()
                .instance()
                .get(&DataKey::TotalFeesWithdrawn)
                .unwrap_or(0),
            fee_percentage: settings.fee_percentage,
        }
    }

    pub fn calculate_fee(env: Env, amount: i128) -> i128 {
        let settings: PlatformSettings = env
            .storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .expect("platform settings not initialized");
        (amount * settings.fee_percentage as i128) / 10000
    }

    pub fn update_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);

        // Update admin in platform settings if initialized
        if env.storage().instance().has(&DataKey::PlatformSettings) {
            let mut settings: PlatformSettings = env
                .storage()
                .instance()
                .get(&DataKey::PlatformSettings)
                .unwrap();
            settings.admin_address = new_admin;
            env.storage()
                .instance()
                .set(&DataKey::PlatformSettings, &settings);
        }
    }

    fn next_room_id(env: &Env) -> u64 {
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextRoomId)
            .unwrap_or(1);

        env.storage()
            .instance()
            .set(&DataKey::NextRoomId, &(id + 1));

        id
    }

    pub fn create_room(env: Env, room_type: RoomType) -> Result<u64, ContractError> {
        let creator = env.invoker();
        creator.require_auth();

        let room_id = next_room_id(&env);

        let mut participants = Vec::new(&env);
        participants.push_back(creator.clone());

        let room = Room {
            id: room_id,
            creator: creator.clone(),
            room_type,
            entry_fee: 0,
            participants,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&DataKey::Room(room_id), &room);

        let mut rooms: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RoomList)
            .unwrap_or(Vec::new(&env));

        rooms.push_back(room_id);

        env.storage().instance().set(&DataKey::RoomList, &rooms);

        Ok(room_id)
    }

    pub fn set_entry_fee(env: Env, room_id: u64, fee: u64) -> Result<(), ContractError> {
        let caller = env.invoker();
        caller.require_auth();

        let mut room: Room = env
            .storage()
            .instance()
            .get(&DataKey::Room(room_id))
            .ok_or(ContractError::RoomNotFound)?;

        if room.creator != caller {
            return Err(ContractError::Unauthorized);
        }

        if let RoomType::TokenGated = room.room_type {
            room.entry_fee = fee;
        } else {
            return Err(ContractError::InvalidRoomType);
        }

        env.storage().instance().set(&DataKey::Room(room_id), &room);

        Ok(())
    }

    pub fn add_participant(env: Env, room_id: u64, user: Address) -> Result<(), ContractError> {
        let caller = env.invoker();
        caller.require_auth();

        let mut room: Room = env
            .storage()
            .instance()
            .get(&DataKey::Room(room_id))
            .ok_or(ContractError::RoomNotFound)?;

        match room.room_type {
            RoomType::Public => {}
            RoomType::InviteOnly => {
                if caller != room.creator {
                    return Err(ContractError::Unauthorized);
                }
            }
            RoomType::TokenGated => {
                // token payment verification goes here later
            }
        }

        if room.participants.contains(&user) {
            return Err(ContractError::UserAlreadyInRoom);
        }

        room.participants.push_back(user);

        env.storage().instance().set(&DataKey::Room(room_id), &room);

        Ok(())
    }

    pub fn remove_participant(env: Env, room_id: u64, user: Address) -> Result<(), ContractError> {
        let caller = env.invoker();
        caller.require_auth();

        let mut room: Room = env
            .storage()
            .instance()
            .get(&DataKey::Room(room_id))
            .ok_or(ContractError::RoomNotFound)?;

        if caller != room.creator && caller != user {
            return Err(ContractError::Unauthorized);
        }

        let mut updated = Vec::new(&env);

        for p in room.participants.iter() {
            if p != user {
                updated.push_back(p);
            }
        }

        room.participants = updated;

        env.storage().instance().set(&DataKey::Room(room_id), &room);

        Ok(())
    }

    pub fn list_rooms(env: Env) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::RoomList)
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_room(env: Env, room_id: u64) -> Result<Room, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Room(room_id))
            .ok_or(ContractError::RoomNotFound)
    }
}

fn require_admin(env: &Env) -> Result<Address, ContractError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(ContractError::NotInitialized)?;

    admin.require_auth();
    Ok(admin)
}

fn validate_username(username: Symbol) -> Result<(), ContractError> {
    // Basic validation relying on Symbol's inherent limits (max 32 chars).
    if username.len() == 0 {
        return Err(ContractError::InvalidUsername);
    }
    Ok(())
}

fn calculate_level(xp: u64) -> u32 {
    match xp {
        0..=99 => 1,
        100..=299 => 2,
        300..=599 => 3,
        600..=999 => 4,
        _ => 5,
    }
}
