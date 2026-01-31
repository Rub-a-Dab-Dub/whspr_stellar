#![no_std]

mod ratelimit;
mod storage;
#[cfg(test)]
mod test;
mod types;

use crate::ratelimit::{check_can_act, record_action};
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String, Symbol, Vec};

pub use crate::storage::*;
pub use crate::types::*;

#[contract]
pub struct BaseContract;

// all this XP point are subject to change
const XP_MESSAGE: u64 = 1;
const XP_TIP_RECEIVED: u64 = 5;

const XP_COOLDOWN_SECONDS: u64 = 30;
const MAX_XP_PER_HOUR: u64 = 60;

const XP_MESSAGE_SENT: u64 = 1;
const MAX_MESSAGES_PER_ROOM: u32 = 10_000;
const MAX_PAGE_SIZE: u32 = 50;

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

        Self::init_badge_metadata(&env);
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

    pub fn get_user_badges(env: Env, user: Address) -> Result<Vec<BadgeMetadata>, ContractError> {
        let profile: UserProfile = env
            .storage()
            .instance()
            .get(&DataKey::User(user))
            .ok_or(ContractError::UserNotFound)?;
        let mut badges = Vec::new(&env);

        for badge in profile.badges.iter() {
            if let Some(metadata) = env
                .storage()
                .instance()
                .get::<_, BadgeMetadata>(&DataKey::BadgeMetadata(badge))
            {
                badges.push_back(metadata);
            }
        }

        Ok(badges)
    }

    pub fn get_paid_room(env: Env, room_id: Symbol) -> Result<PaidRoom, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::PaidRoom(room_id))
            .ok_or(ContractError::RoomNotFound)
    }

    pub fn has_access(env: Env, user: Address, room_id: Symbol) -> bool {
        let key = DataKey::PaidRoomMember(room_id, user);
        if let Some(member) = env.storage().instance().get::<_, PaidRoomMember>(&key) {
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

    pub fn create_paid_room(
        env: Env,
        creator: Address,
        room_id: Symbol,
        entry_fee: i128,
    ) -> Result<(), ContractError> {
        creator.require_auth();

        if env
            .storage()
            .instance()
            .has(&DataKey::PaidRoom(room_id.clone()))
        {
            return Err(ContractError::RoomAlreadyExists);
        }

        let room = PaidRoom {
            id: room_id.clone(),
            creator: creator.clone(),
            entry_fee,
            is_cancelled: false,
            total_revenue: 0,
        };

        env.storage()
            .instance()
            .set(&DataKey::PaidRoom(room_id), &room);

        let room_count = Self::increment_room_created_count(&env, creator.clone());
        if room_count == 1 {
            let _ = Self::award_badge(&env, creator, Badge::RoomCreator)?;
        }
        Ok(())
    }

    pub fn pay_entry_fee(env: Env, user: Address, room_id: Symbol) -> Result<(), ContractError> {
        user.require_auth();

        let mut room: PaidRoom = env
            .storage()
            .instance()
            .get(&DataKey::PaidRoom(room_id.clone()))
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
            .set(&DataKey::PaidRoom(room_id.clone()), &room);

        // Grant access
        let member = PaidRoomMember {
            has_access: true,
            joined_at: env.ledger().timestamp(),
        };
        env.storage()
            .instance()
            .set(&DataKey::PaidRoomMember(room_id, user), &member);

        Ok(())
    }

    pub fn cancel_paid_room(
        env: Env,
        creator: Address,
        room_id: Symbol,
    ) -> Result<(), ContractError> {
        creator.require_auth();

        let mut room: PaidRoom = env
            .storage()
            .instance()
            .get(&DataKey::PaidRoom(room_id.clone()))
            .ok_or(ContractError::RoomNotFound)?;

        if room.creator != creator {
            return Err(ContractError::NotRoomCreator);
        }

        room.is_cancelled = true;
        env.storage()
            .instance()
            .set(&DataKey::PaidRoom(room_id), &room);
        Ok(())
    }

    pub fn refund_entry_fee(env: Env, user: Address, room_id: Symbol) -> Result<(), ContractError> {
        user.require_auth();

        let room: PaidRoom = env
            .storage()
            .instance()
            .get(&DataKey::PaidRoom(room_id.clone()))
            .ok_or(ContractError::RoomNotFound)?;

        if !room.is_cancelled {
            // Usually refunds are only for cancelled rooms in this design
            return Err(ContractError::Unauthorized);
        }

        let key = DataKey::PaidRoomMember(room_id.clone(), user.clone());
        let mut member: PaidRoomMember = env
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

        validate_username(&env, username.clone())?;

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
            .set(&DataKey::Username(username.clone()), &user);

        // Emit user registration event
        env.events().publish(
            (Symbol::new(&env, "user_registered"), user),
            (username, env.ledger().timestamp()),
        );

        Ok(())
    }

    pub fn update_username(
        env: Env,
        user: Address,
        new_username: Symbol,
    ) -> Result<(), ContractError> {
        user.require_auth();

        validate_username(&env, new_username.clone())?;

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

        let old_username = profile.username.clone();

        env.storage()
            .instance()
            .remove(&DataKey::Username(profile.username.clone()));
        env.storage()
            .instance()
            .set(&DataKey::Username(new_username.clone()), &user);

        profile.username = new_username.clone();

        env.storage().instance().set(&DataKey::User(user.clone()), &profile);

        // Emit username update event
        env.events().publish(
            (Symbol::new(&env, "username_updated"), user),
            (old_username, new_username),
        );

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

        let old_xp = profile.xp;
        let old_level = profile.level;

        profile.xp += xp_amount;
        profile.level = calculate_level(profile.xp);

        env.storage().instance().set(&DataKey::User(user.clone()), &profile);

        // Emit XP change event
        env.events().publish(
            (Symbol::new(&env, "xp_changed"), user.clone()),
            (old_xp, profile.xp, xp_amount),
        );

        // Emit level up event if level changed
        if profile.level > old_level {
            env.events().publish(
                (Symbol::new(&env, "level_up"), user),
                (old_level, profile.level),
            );
        }

        Ok(())
    }

    fn award_xp(
        env: &Env,
        user: Address,
        xp_amount: u64,
        action: ActionType,
    ) -> Result<(u32, u32), ContractError> {
        let now = env.ledger().timestamp();

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
        let old_xp = profile.xp;

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

        // Emit XP change event
        env.events().publish(
            (Symbol::new(env, "xp_changed"), user.clone()),
            (old_xp, profile.xp, xp_amount),
        );

        Ok((old_level, profile.level))
    }

    fn emit_level_up(env: &Env, user: Address, old_level: u32, new_level: u32) {
        if new_level > old_level {
            env.events()
                .publish((Symbol::new(env, "level_up"), user), (old_level, new_level));
        }
    }

    fn init_badge_metadata(env: &Env) {
        Self::set_badge_metadata(
            env,
            Badge::FirstMessage,
            "First Message",
            "Sent your first message",
            "ipfs://badge-first-message",
            BadgeRarity::Common,
        );
        Self::set_badge_metadata(
            env,
            Badge::Tipper100,
            "Tipper 100",
            "Received 100 tips",
            "ipfs://badge-tipper-100",
            BadgeRarity::Rare,
        );
        Self::set_badge_metadata(
            env,
            Badge::Level10,
            "Level 10",
            "Reached level 10",
            "ipfs://badge-level-10",
            BadgeRarity::Epic,
        );
        Self::set_badge_metadata(
            env,
            Badge::RoomCreator,
            "Room Creator",
            "Created your first room",
            "ipfs://badge-room-creator",
            BadgeRarity::Uncommon,
        );
    }

    fn set_badge_metadata(
        env: &Env,
        badge: Badge,
        name: &str,
        description: &str,
        icon_url: &str,
        rarity: BadgeRarity,
    ) {
        let key = DataKey::BadgeMetadata(badge);
        if env.storage().instance().has(&key) {
            return;
        }

        let metadata = BadgeMetadata {
            badge,
            name: String::from_str(env, name),
            description: String::from_str(env, description),
            icon_url: String::from_str(env, icon_url),
            rarity,
        };

        env.storage().instance().set(&key, &metadata);
    }

    fn award_badge(env: &Env, user: Address, badge: Badge) -> Result<bool, ContractError> {
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

        for existing in profile.badges.iter() {
            if existing == badge {
                return Ok(false);
            }
        }

        profile.badges.push_back(badge);
        env.storage().instance().set(&DataKey::User(user), &profile);

        Ok(true)
    }

    fn check_level_badges(
        env: &Env,
        user: Address,
        old_level: u32,
        new_level: u32,
    ) -> Result<(), ContractError> {
        if old_level < 10 && new_level >= 10 {
            let _ = Self::award_badge(env, user, Badge::Level10)?;
        }
        Ok(())
    }

    fn increment_message_count(env: &Env, user: Address) -> u32 {
        Self::increment_counter(env, DataKey::UserMessageCount(user))
    }

    fn increment_tip_received_count(env: &Env, user: Address) -> u32 {
        Self::increment_counter(env, DataKey::UserTipReceivedCount(user))
    }

    fn increment_room_created_count(env: &Env, user: Address) -> u32 {
        Self::increment_counter(env, DataKey::UserRoomsCreated(user))
    }

    fn increment_counter(env: &Env, key: DataKey) -> u32 {
        let mut count: u32 = env.storage().instance().get(&key).unwrap_or(0);
        count = count.saturating_add(1);
        env.storage().instance().set(&key, &count);
        count
    }

    fn record_message_action(env: &Env, user: Address) -> Result<(), ContractError> {
        check_can_act(env, &user, ActionType::Message);
        record_action(env, &user, ActionType::Message);

        let message_count = Self::increment_message_count(env, user.clone());
        if message_count == 1 {
            let _ = Self::award_badge(env, user, Badge::FirstMessage)?;
        }
        Ok(())
    }

    pub fn reward_message(env: Env, user: Address) -> Result<(), ContractError> {
        ratelimit::check_can_act(&env, &user, ActionType::Message);

        let (old_level, new_level) =
            Self::award_xp(&env, user.clone(), XP_MESSAGE, ActionType::Message)?;

        record_action(&env, &user, ActionType::Message);

        Self::check_level_badges(&env, user.clone(), old_level, new_level)?;

        Self::emit_level_up(&env, user, old_level, new_level);

        Ok(())
    }

    pub fn reward_tip_received(env: Env, user: Address) -> Result<(), ContractError> {
        require_admin(&env)?;
        let (old_level, new_level) =
            Self::award_xp(&env, user.clone(), XP_TIP_RECEIVED, ActionType::TipReceived)?;

        let tip_count = Self::increment_tip_received_count(&env, user.clone());
        if tip_count >= 100 {
            let _ = Self::award_badge(&env, user.clone(), Badge::Tipper100)?;
        }

        Self::check_level_badges(&env, user.clone(), old_level, new_level)?;

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
        
        let old_fee_percentage = settings.fee_percentage;
        settings.fee_percentage = new_fee_percentage;
        
        env.storage()
            .instance()
            .set(&DataKey::PlatformSettings, &settings);

        // Emit fee percentage update event
        env.events().publish(
            (Symbol::new(&env, "fee_percentage_updated"), admin),
            (old_fee_percentage, new_fee_percentage, env.ledger().timestamp()),
        );
    }

    pub fn collect_fee(env: Env, caller: Address, amount: i128) -> Result<(), ContractError> {
        // Authorization: Only the contract itself or admin can call this function
        let contract_address = env.current_contract_address();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        
        // Require auth from either the contract itself or the admin
        if caller != contract_address && caller != admin {
            caller.require_auth();
            if caller != admin {
                return Err(ContractError::Unauthorized);
            }
        }

        // Validate amount
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        Self::internal_collect_fee(&env, amount)
    }

    /// Internal helper function for collecting fees - used by contract functions
    fn internal_collect_fee(env: &Env, amount: i128) -> Result<(), ContractError> {
        let settings: PlatformSettings = env
            .storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .ok_or(ContractError::NotInitialized)?;
        
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

        // Emit fee collection event
        env.events().publish(
            (Symbol::new(&env, "fee_collected"),),
            (fee_amount, treasury_balance, env.ledger().timestamp()),
        );
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

        // Emit treasury withdrawal event
        env.events().publish(
            (Symbol::new(&env, "treasury_withdrawal"), admin, recipient),
            (amount, treasury_balance, env.ledger().timestamp()),
        );
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

        let old_admin = admin.clone();

        env.storage().instance().set(&DataKey::Admin, &new_admin);

        // Update admin in platform settings if initialized
        if env.storage().instance().has(&DataKey::PlatformSettings) {
            let mut settings: PlatformSettings = env
                .storage()
                .instance()
                .get(&DataKey::PlatformSettings)
                .unwrap();
            settings.admin_address = new_admin.clone();
            env.storage()
                .instance()
                .set(&DataKey::PlatformSettings, &settings);
        }

        // Emit admin change event
        env.events().publish(
            (Symbol::new(&env, "admin_changed"),),
            (old_admin, new_admin, env.ledger().timestamp()),
        );
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

    pub fn create_room(
        env: Env,
        creator: Address,
        room_type: RoomType,
    ) -> Result<u64, ContractError> {
        creator.require_auth();

        let room_id = Self::next_room_id(&env);

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

        env.storage()
            .instance()
            .set(&DataKey::RoomById(room_id), &room);

        let mut rooms: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RoomList)
            .unwrap_or(Vec::new(&env));

        rooms.push_back(room_id);

        env.storage().instance().set(&DataKey::RoomList, &rooms);

        let room_count = Self::increment_room_created_count(&env, creator.clone());
        if room_count == 1 {
            let _ = Self::award_badge(&env, creator, Badge::RoomCreator)?;
        }

        Ok(room_id)
    }

    pub fn set_entry_fee(
        env: Env,
        caller: Address,
        room_id: u64,
        fee: u64,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let mut room: Room = env
            .storage()
            .instance()
            .get(&DataKey::RoomById(room_id))
            .ok_or(ContractError::RoomNotFound)?;

        if room.creator != caller {
            return Err(ContractError::Unauthorized);
        }

        if let RoomType::TokenGated = room.room_type {
            room.entry_fee = fee;
        } else {
            return Err(ContractError::InvalidRoomType);
        }

        env.storage()
            .instance()
            .set(&DataKey::RoomById(room_id), &room);

        Ok(())
    }

    pub fn add_participant(
        env: Env,
        caller: Address,
        room_id: u64,
        user: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let mut room: Room = env
            .storage()
            .instance()
            .get(&DataKey::RoomById(room_id))
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

        env.storage()
            .instance()
            .set(&DataKey::RoomById(room_id), &room);

        Ok(())
    }

    pub fn remove_participant(
        env: Env,
        caller: Address,
        room_id: u64,
        user: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let mut room: Room = env
            .storage()
            .instance()
            .get(&DataKey::RoomById(room_id))
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

        env.storage()
            .instance()
            .set(&DataKey::RoomById(room_id), &room);

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
            .get(&DataKey::RoomById(room_id))
            .ok_or(ContractError::RoomNotFound)
    }

    fn next_message_id(env: &Env, room_id: u64) -> u64 {
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextMessageId(room_id))
            .unwrap_or(1);

        env.storage()
            .instance()
            .set(&DataKey::NextMessageId(room_id), &(id + 1));

        id
    }

    pub fn send_message(
        env: Env,
        sender: Address,
        room_id: u64,
        content_hash: BytesN<32>,
        tip_amount: u64,
    ) -> Result<u64, ContractError> {
        sender.require_auth();

        verify_content_hash(&content_hash)?;

        let mut room: Room = env
            .storage()
            .instance()
            .get(&DataKey::RoomById(room_id))
            .ok_or(ContractError::RoomNotFound)?;

        // Ensure sender is participant
        if !room.participants.contains(&sender) {
            return Err(ContractError::Unauthorized);
        }

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MessageCount(room_id))
            .unwrap_or(0);

        if count >= MAX_MESSAGES_PER_ROOM {
            return Err(ContractError::RoomMessageLimitReached);
        }

        let message_id = Self::next_message_id(&env, room_id);

        Self::record_message_action(&env, sender.clone())?;

        let message = Message {
            id: message_id,
            room_id,
            sender: sender.clone(),
            content_hash,
            timestamp: env.ledger().timestamp(),
            tip_amount,
        };

        env.storage()
            .instance()
            .set(&DataKey::Message(room_id, message_id), &message);

        env.storage()
            .instance()
            .set(&DataKey::MessageCount(room_id), &(count + 1));

        // XP reward (already spam-protected)
        let (old_level, new_level) =
            Self::award_xp(&env, sender.clone(), XP_MESSAGE_SENT, ActionType::Message)?;

        Self::emit_level_up(&env, sender, old_level, new_level);

        Ok(message_id)
    }

    pub fn get_messages(
        env: Env,
        room_id: u64,
        start_after: Option<u64>,
        limit: u32,
    ) -> Result<Vec<Message>, ContractError> {
        let max = if limit > MAX_PAGE_SIZE {
            MAX_PAGE_SIZE
        } else {
            limit
        };

        let total: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MessageCount(room_id))
            .unwrap_or(0);

        let mut messages = Vec::new(&env);

        let mut current = start_after.unwrap_or(0) + 1;
        let mut fetched = 0;

        while fetched < max && current <= total as u64 {
            if let Some(msg) = env
                .storage()
                .instance()
                .get(&DataKey::Message(room_id, current))
            {
                messages.push_back(msg);
                fetched += 1;
            }
            current += 1;
        }

        Ok(messages)
    }

    fn next_invitation_id(env: &Env) -> u64 {
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextInvitationId)
            .unwrap_or(1);
        env.storage()
            .instance()
            .set(&DataKey::NextInvitationId, &(id + 1));
        id
    }

    pub fn create_invitation(
        env: Env,
        caller: Address,
        room_id: u64,
        invitee: Address,
        expires_at: u64,
        max_uses: Option<u32>,
    ) -> Result<u64, ContractError> {
        caller.require_auth();

        let room: Room = env
            .storage()
            .instance()
            .get(&DataKey::RoomById(room_id))
            .ok_or(ContractError::RoomNotFound)?;

        // Verify caller is creator or admin (participant with invite permission)
        if room.creator != caller && !room.participants.contains(&caller) {
            return Err(ContractError::Unauthorized);
        }

        let invitation_id = Self::next_invitation_id(&env);
        let now = env.ledger().timestamp();

        if expires_at <= now {
            return Err(ContractError::InvitationExpired);
        }

        let invitation = Invitation {
            id: invitation_id,
            room_id,
            inviter: caller,
            invitee: invitee.clone(),
            created_at: now,
            expires_at,
            max_uses,
            use_count: 0,
            is_revoked: false,
        };

        env.storage()
            .instance()
            .set(&DataKey::Invitation(invitation_id), &invitation);

        // Add to user's invitations list
        let mut user_invites: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::UserInvitations(invitee.clone()))
            .unwrap_or(Vec::new(&env));
        user_invites.push_back(invitation_id);
        env.storage()
            .instance()
            .set(&DataKey::UserInvitations(invitee.clone()), &user_invites);

        // Add to room's invitations list
        let mut room_invites: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RoomInvitations(room_id))
            .unwrap_or(Vec::new(&env));
        room_invites.push_back(invitation_id);
        env.storage()
            .instance()
            .set(&DataKey::RoomInvitations(room_id), &room_invites);

        env.events().publish(
            (Symbol::new(&env, "invite_created"), invitation_id),
            (room_id, invitee),
        );

        Ok(invitation_id)
    }

    pub fn accept_invitation(env: Env, caller: Address, invitation_id: u64) -> Result<(), ContractError> {
        caller.require_auth();

        let mut invitation: Invitation = env
            .storage()
            .instance()
            .get(&DataKey::Invitation(invitation_id))
            .ok_or(ContractError::InvitationNotFound)?;

        if invitation.invitee != caller {
            return Err(ContractError::Unauthorized);
        }

        if invitation.is_revoked {
            return Err(ContractError::InvitationRevoked);
        }

        let now = env.ledger().timestamp();
        if now > invitation.expires_at {
            return Err(ContractError::InvitationExpired);
        }

        if let Some(max) = invitation.max_uses {
            if invitation.use_count >= max {
                return Err(ContractError::InvitationMaxUsesReached);
            }
        }

        // Add user to room
        let mut room: Room = env
            .storage()
            .instance()
            .get(&DataKey::RoomById(invitation.room_id))
            .ok_or(ContractError::RoomNotFound)?;

        if !room.participants.contains(&caller) {
            room.participants.push_back(caller.clone());
            env.storage()
                .instance()
                .set(&DataKey::RoomById(invitation.room_id), &room);
        }

        // Increment use count
        invitation.use_count += 1;
        env.storage()
            .instance()
            .set(&DataKey::Invitation(invitation_id), &invitation);

        env.events().publish(
            (Symbol::new(&env, "invite_accepted"), invitation_id),
            (invitation.room_id, caller),
        );

        Ok(())
    }

    pub fn revoke_invitation(env: Env, caller: Address, invitation_id: u64) -> Result<(), ContractError> {
        caller.require_auth();

        let mut invitation: Invitation = env
            .storage()
            .instance()
            .get(&DataKey::Invitation(invitation_id))
            .ok_or(ContractError::InvitationNotFound)?;

        let room: Room = env
            .storage()
            .instance()
            .get(&DataKey::RoomById(invitation.room_id))
            .ok_or(ContractError::RoomNotFound)?;

        // Verify caller is inviter or room creator
        if caller != invitation.inviter && caller != room.creator {
            return Err(ContractError::NotInviter);
        }

        invitation.is_revoked = true;
        env.storage()
            .instance()
            .set(&DataKey::Invitation(invitation_id), &invitation);

        env.events().publish(
            (Symbol::new(&env, "invite_revoked"), invitation_id),
            invitation.room_id,
        );

        Ok(())
    }

    pub fn get_user_invitations(env: Env, user: Address) -> Vec<Invitation> {
        let invite_ids: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::UserInvitations(user))
            .unwrap_or(Vec::new(&env));

        let mut invitations = Vec::new(&env);
        for id in invite_ids.iter() {
            if let Some(invite) = env.storage().instance().get(&DataKey::Invitation(id)) {
                invitations.push_back(invite);
            }
        }
        invitations
    }

    pub fn get_room_invitations(env: Env, room_id: u64) -> Vec<Invitation> {
        let invite_ids: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RoomInvitations(room_id))
            .unwrap_or(Vec::new(&env));

        let mut invitations = Vec::new(&env);
        for id in invite_ids.iter() {
            if let Some(invite) = env.storage().instance().get(&DataKey::Invitation(id)) {
                invitations.push_back(invite);
            }
        }
        invitations
    }

    pub fn get_invitation_status(env: Env, invitation_id: u64) -> Result<InvitationStatus, ContractError> {
        let invitation: Invitation = env
            .storage()
            .instance()
            .get(&DataKey::Invitation(invitation_id))
            .ok_or(ContractError::InvitationNotFound)?;

        if invitation.is_revoked {
            return Ok(InvitationStatus::Revoked);
        }

        let now = env.ledger().timestamp();
        if now > invitation.expires_at {
            return Ok(InvitationStatus::Expired);
        }

        if let Some(max) = invitation.max_uses {
            if invitation.use_count >= max {
                return Ok(InvitationStatus::Accepted);
            }
        }

        if invitation.use_count > 0 {
            Ok(InvitationStatus::Accepted)
        } else {
            Ok(InvitationStatus::Pending)
        }
    }
}

pub fn tip_message(
    env: Env,
    sender: Address,
    message_id: u64,
    receiver: Address,
    amount: i128,
) -> Result<u64, ContractError> {
    sender.require_auth();

    // min tip: 1, max tip: 1000000
    if amount < 1 || amount > 1_000_000 {
        return Err(ContractError::InvalidAmount);
    }

    // Calculate platform fee (2%)
    let fee = (amount * 2) / 100;
    let net = amount - fee;

    // Transfer net to receiver
    let settings = Self::get_platform_settings(env.clone());
    let token_client = token::Client::new(&env, &settings.fee_token);
    token_client.transfer(&sender, &receiver, &net);

    // Transfer fee to treasury
    token_client.transfer(&sender, &env.current_contract_address(), &fee);

    // Record tip
    let tip_id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TipCount)
        .unwrap_or(1);
    env.storage().instance().set(&DataKey::TipCount, &(tip_id + 1));

    let tip = Tip {
        id: tip_id,
        sender: sender.clone(),
        receiver: receiver.clone(),
        amount,
        fee,
        message_id,
        timestamp: env.ledger().timestamp(),
    };

    env.storage().instance().set(&DataKey::TipById(tip_id), &tip);

    // Update user histories
    let mut sent: Vec<u64> = env
        .storage()
        .instance()
        .get(&DataKey::TipsSentByUser(sender.clone()))
        .unwrap_or(Vec::new(&env));
    sent.push_back(tip_id);
    env.storage().instance().set(&DataKey::TipsSentByUser(sender.clone()), &sent);

    let mut received: Vec<u64> = env
        .storage()
        .instance()
        .get(&DataKey::TipsReceivedByUser(receiver.clone()))
        .unwrap_or(Vec::new(&env));
    received.push_back(tip_id);
    env.storage()
        .instance()
        .set(&DataKey::TipsReceivedByUser(receiver.clone()), &received);

    // Update total tipped
    let total: i128 = env
        .storage()
        .instance()
        .get(&DataKey::TotalTippedByUser(sender.clone()))
        .unwrap_or(0);
    env.storage()
        .instance()
        .set(&DataKey::TotalTippedByUser(sender.clone()), &(total + amount));

    // Award XP for tipping (+20)
    let _ = Self::award_xp(&env, sender.clone(), 20, ActionType::Tip)?;

    // Emit event
    env.events().publish(
        (Symbol::new(&env, "tip"),),
        (tip_id, sender, receiver, amount, fee, message_id),
    );

    Ok(tip_id)
}
 pub fn record_transaction(
        env: Env,
        tx_hash: BytesN<32>,
        tx_type: Symbol,
        status: Symbol,
        sender: Address,
        receiver: Option<Address>,
        amount: Option<i128>,
    ) -> Result<u64, ContractError> {
        // Increment total transaction count
        let mut tx_count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TransactionCount)
            .unwrap_or(0);
        tx_count += 1;
        env.storage().instance().set(&DataKey::TransactionCount, &tx_count);

        // Create transaction struct
        let tx = Transaction {
            id: tx_count,
            tx_hash,
            tx_type: tx_type.clone(),
            status: status.clone(),
            sender: sender.clone(),
            receiver,
            amount,
            timestamp: env.ledger().timestamp(),
        };

        // Save transaction
        env.storage()
            .instance()
            .set(&DataKey::TransactionById(tx_count), &tx);

        // Index by user
        let mut user_txs: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::TransactionsByUser(sender.clone()))
            .unwrap_or(Vec::new(&env));
        user_txs.push_back(tx_count);
        env.storage()
            .instance()
            .set(&DataKey::TransactionsByUser(sender), &user_txs);

        Ok(tx_count)
    }

      pub fn record_user_activity(env: Env, user: Address, active: bool) {
        // Increment active counters
        let mut analytics: Analytics = env.storage().get(&DataKey::AnalyticsDashboard).unwrap_or_default();
        if active {
            analytics.total_users += 1; // Increment total if new
            analytics.active_users_daily += 1;
            analytics.active_users_weekly += 1;
            analytics.active_users_monthly += 1;
        }
        env.storage().set(&DataKey::AnalyticsDashboard, &analytics);
    }

    pub fn record_message(env: Env, room: Symbol) {
        let mut analytics: Analytics = env.storage().get(&DataKey::AnalyticsDashboard).unwrap_or_default();
        analytics.total_messages += 1;
        env.storage().set(&DataKey::AnalyticsDashboard, &analytics);
    }

    pub fn record_tip(env: Env, amount: u64, fee: u64) {
        let mut analytics: Analytics = env.storage().get(&DataKey::AnalyticsDashboard).unwrap_or_default();
        analytics.total_tips += 1;
        analytics.total_tip_revenue += fee;
        env.storage().set(&DataKey::AnalyticsDashboard, &analytics);
    }

    pub fn record_room_fee(env: Env, amount: u64) {
        let mut analytics: Analytics = env.storage().get(&DataKey::AnalyticsDashboard).unwrap_or_default();
        analytics.total_room_fees += amount;
        env.storage().set(&DataKey::AnalyticsDashboard, &analytics);
    }

    pub fn get_dashboard(env: Env) -> Analytics {
        env.storage().get(&DataKey::AnalyticsDashboard).unwrap_or_default()
    }

fn verify_content_hash(hash: &BytesN<32>) -> Result<(), ContractError> {
    if hash.to_array() == [0u8; 32] {
        return Err(ContractError::InvalidContentHash);
    }
    Ok(())
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

fn validate_username(env: &Env, username: Symbol) -> Result<(), ContractError> {
    if username == Symbol::new(env, "") {
        return Err(ContractError::InvalidUsername);
    }
    Ok(())
}

fn calculate_level(xp: u64) -> u32 {
    let level = (xp / 100).saturating_add(1);
    level as u32
}
