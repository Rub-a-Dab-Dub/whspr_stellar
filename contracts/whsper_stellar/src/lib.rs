#![no_std]

use soroban_sdk::{
    Address, Env, Symbol, Vec, contract, contracterror, contractimpl, contracttype, token,
};

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    UserAlreadyRegistered = 4,
    UserNotFound = 5,
    UsernameTaken = 6,
    InvalidUsername = 7,
    RoomAlreadyExists = 8,
    RoomNotFound = 9,
    RoomCancelled = 10,
    NotRoomCreator = 11,
    AccessAlreadyGranted = 12,
    InsufficientFunds = 13,
}

#[contract]
pub struct BaseContract;

/// Storage keys
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Metadata,
    Treasury,
    PlatformSettings,
    TotalFeesCollected,
    TotalFeesWithdrawn,
    User(Address),
    Username(Symbol),
    Room(Symbol),
    RoomMember(Symbol, Address),
    CreatorBalance(Address),
}

/// Simple metadata structure
#[derive(Clone)]
#[contracttype]
pub struct ContractMetadata {
    pub name: Symbol,
    pub version: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct PlatformSettings {
    pub fee_percentage: u32,
    pub admin_address: Address,
    pub fee_token: Address,
}

/// Treasury analytics data
#[derive(Clone)]
#[contracttype]
pub struct TreasuryAnalytics {
    pub current_balance: i128,
    pub total_collected: i128,
    pub total_withdrawn: i128,
    pub fee_percentage: u32,
}
#[derive(Clone)]
#[contracttype]
pub struct UserProfile {
    pub address: Address,
    pub username: Symbol,
    pub xp: u64,
    pub level: u32,
    pub badges: Vec<Symbol>,
    pub join_date: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct Room {
    pub id: Symbol,
    pub creator: Address,
    pub entry_fee: i128,
    pub is_cancelled: bool,
    pub total_revenue: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct RoomMember {
    pub has_access: bool,
    pub joined_at: u64,
}

#[contractimpl]
impl BaseContract {
    pub fn init(env: Env, admin: Address, name: Symbol, version: u32) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        admin.require_auth();

        let metadata = ContractMetadata { name, version };

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Metadata, &metadata);
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

    pub fn register_user(env: Env, caller: Address, username: Symbol) -> Result<(), ContractError> {
        caller.require_auth();

        validate_username(&env, &username)?;

        if env.storage().instance().has(&DataKey::User(caller.clone())) {
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
            address: caller.clone(),
            username: username.clone(),
            xp: 0,
            level: 1,
            badges: Vec::new(&env),
            join_date: env.ledger().timestamp(),
        };

        env.storage()
            .instance()
            .set(&DataKey::User(caller.clone()), &profile);

        env.storage()
            .instance()
            .set(&DataKey::Username(username), &caller);

        Ok(())
    }

    pub fn get_user_profile(env: Env, user: Address) -> UserProfile {
        env.storage()
            .instance()
            .get(&DataKey::User(user))
            .expect("user not found")
    }

    pub fn update_username(
        env: Env,
        caller: Address,
        new_username: Symbol,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        validate_username(&env, &new_username)?;

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
            .get(&DataKey::User(caller.clone()))
            .ok_or(ContractError::UserNotFound)?;

        env.storage()
            .instance()
            .remove(&DataKey::Username(profile.username.clone()));

        env.storage()
            .instance()
            .set(&DataKey::Username(new_username.clone()), &caller);

        profile.username = new_username;

        env.storage()
            .instance()
            .set(&DataKey::User(caller), &profile);

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

    /// Initialize platform settings (must be called after init)
    pub fn init_platform_settings(env: Env, fee_percentage: u32, fee_token: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");

        admin.require_auth();

        // Validate fee percentage (max 10000 basis points = 100%)
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

    /// Get platform settings
    pub fn get_platform_settings(env: Env) -> PlatformSettings {
        env.storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .expect("platform settings not initialized")
    }

    /// Update fee percentage (admin only)
    pub fn update_fee_percentage(env: Env, new_fee_percentage: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");

        admin.require_auth();

        // Validate fee percentage
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

    /// Collect fees and add to treasury
    /// This would be called internally by other contract functions
    pub fn collect_fee(env: Env, amount: i128) {
        let settings: PlatformSettings = env
            .storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .expect("platform settings not initialized");

        // Calculate fee amount
        let fee_amount = (amount * settings.fee_percentage as i128) / 10000;

        // Update treasury balance
        let mut treasury_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap_or(0);

        treasury_balance += fee_amount;
        env.storage()
            .instance()
            .set(&DataKey::Treasury, &treasury_balance);

        // Update total fees collected
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

    /// Withdraw fees from treasury (admin only)
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

        // Transfer tokens to recipient
        let token_client = token::Client::new(&env, &settings.fee_token);
        token_client.transfer(&env.current_contract_address(), &recipient, &amount);

        // Update treasury balance
        treasury_balance -= amount;
        env.storage()
            .instance()
            .set(&DataKey::Treasury, &treasury_balance);

        // Update total withdrawn
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

    /// Get current treasury balance
    pub fn get_treasury_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap_or(0)
    }

    /// Get total fees collected (lifetime)
    pub fn get_total_fees_collected(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalFeesCollected)
            .unwrap_or(0)
    }

    /// Get total fees withdrawn (lifetime)
    pub fn get_total_fees_withdrawn(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalFeesWithdrawn)
            .unwrap_or(0)
    }

    /// Get comprehensive treasury analytics
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

    /// Calculate fee for a given amount
    pub fn calculate_fee(env: Env, amount: i128) -> i128 {
        let settings: PlatformSettings = env
            .storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .expect("platform settings not initialized");

        (amount * settings.fee_percentage as i128) / 10000
    }

    /// Update admin address (admin only)
    pub fn update_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);

        // Update admin in platform settings as well
        let mut settings: PlatformSettings = env
            .storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .expect("platform settings not initialized");

        settings.admin_address = new_admin;
        env.storage()
            .instance()
            .set(&DataKey::PlatformSettings, &settings);
    }
}

fn validate_username(_env: &Env, _username: &Symbol) -> Result<(), ContractError> {
    // Symbol doesn't easily expose length without conversion,
    // for now we trust the client or add a small check if possible.
    Ok(())
}

// subject to change base on xp point design
fn calculate_level(xp: u64) -> u32 {
    match xp {
        0..=99 => 1,
        100..=299 => 2,
        300..=599 => 3,
        600..=999 => 4,
        _ => 5,
    }
}
