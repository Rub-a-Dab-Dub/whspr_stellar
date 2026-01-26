#![no_std]

use soroban_sdk::{Address, Env, Symbol, contract, contracterror, contractimpl, contracttype, token};

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
    XpCooldownActive = 8,
    XpRateLimited = 9
}

#[derive(Clone)]
#[contracttype]
pub enum ActionType {
    Message,
    TipReceived,
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
    HourlyXp(Address, u64)
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

#[contractimpl]
impl BaseContract {
    pub fn init(env: Env, admin: Address, name: Symbol, version: u32) {
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
    }

    pub fn admin(env: Env) -> Result<UserProfile, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn get_user_profile(env: Env, user: Address) -> Result<UserProfile, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::User(user))
            .ok_or(ContractError::UserNotFound)
    }

    pub fn register_user(env: Env, username: Symbol) -> Result<(), ContractError> {
        let caller = env.invoker();
        caller.require_auth();

        validate_username(&username)?;

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

    pub fn update_username(env: Env, new_username: Symbol) -> Result<(), ContractError> {
        let caller = env.invoker();
        caller.require_auth();

        validate_username(&new_username)?;

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
fn validate_username(username: &Symbol) {
    let len = username.len();
    if len < 3 || len > 16 {
        return Err(ContractError::InvalidUsername);
    }
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
