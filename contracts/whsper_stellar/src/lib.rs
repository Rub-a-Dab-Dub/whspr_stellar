#![no_std]

use soroban_sdk::{
    Address, Env, Symbol, contract, contracterror, contractimpl, contracttype, token,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    UserAlreadyRegistered = 4,
    UserNotFound = 5,
    UsernameTaken = 6,
    InvalidUsername = 7,
    XpCooldownActive = 8,
    XpRateLimited = 9,
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
    HourlyXp(Address, u64),
}

// all this XP point are subject to change
const XP_MESSAGE: u64 = 1;
const XP_TIP_RECEIVED: u64 = 5;

const XP_COOLDOWN_SECONDS: u64 = 30;
const MAX_XP_PER_HOUR: u64 = 60;

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
    pub fn init(env: Env, admin: Address, name: Symbol, version: u32) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        admin.require_auth();

        let metadata = ContractMetadata { name, version };
        
        // Default Rate Limit Config
        let config = RateLimitConfig {
            message_cooldown: 60, // 1 minute
            tip_cooldown: 300,    // 5 minutes
            transfer_cooldown: 600, // 10 minutes
            daily_message_limit: 100,
            daily_tip_limit: 50,
            daily_transfer_limit: 20,
        };

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Metadata, &metadata);
        env.storage().instance().set(&DataKey::RateLimitConfig, &config);
        
        // Initialize Treasury Keys
        env.storage().instance().set(&DataKey::Treasury, &0i128);
        env.storage().instance().set(&DataKey::TotalFeesCollected, &0i128);
        env.storage().instance().set(&DataKey::TotalFeesWithdrawn, &0i128);

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
        env.storage().instance().set(&DataKey::RateLimitConfig, &config);
    }

    pub fn set_reputation(env: Env, user: Address, reputation: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::UserReputation(user), &reputation);
    }

    pub fn set_override(env: Env, user: Address, is_exempt: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::AdminOverride(user), &is_exempt);
    }

    // User Profile Functions (New)
    pub fn get_user_profile(env: Env, user: Address) -> Result<UserProfile, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::User(user))
            .ok_or(ContractError::UserNotFound)
    }

    pub fn register_user(env: Env, user: Address, username: Symbol) -> Result<(), ContractError> {
        user.require_auth();

        validate_username(&env, username.clone())?;

        if env.storage().instance().has(&DataKey::User(user.clone())) {
            return Err(ContractError::UserAlreadyRegistered);
        }

        if env.storage().instance().has(&DataKey::Username(username.clone())) {
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

        env.storage().instance().set(&DataKey::User(user.clone()), &profile);
        env.storage().instance().set(&DataKey::Username(username), &user);

        Ok(())
    }

    pub fn update_username(env: Env, user: Address, new_username: Symbol) -> Result<(), ContractError> {
        user.require_auth();

        validate_username(&env, new_username.clone())?;

        if env.storage().instance().has(&DataKey::Username(new_username.clone())) {
            return Err(ContractError::UsernameTaken);
        }

        let mut profile: UserProfile = env
            .storage()
            .instance()
            .get(&DataKey::User(user.clone()))
            .ok_or(ContractError::UserNotFound)?;

        env.storage().instance().remove(&DataKey::Username(profile.username.clone()));
        env.storage().instance().set(&DataKey::Username(new_username.clone()), &user);

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
            .get::<_, u64>(&DataKey::LastAction(user.clone(), action.clone()))
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
            .ok_or(ContractError::UserNotFound)?;

        let old_level = profile.level;

        profile.xp += xp_amount;
        profile.level = calculate_level(profile.xp);

        env.storage()
            .instance()
            .set(&DataKey::User(user.clone()), &profile);
        env.storage()
            .instance()
            .set(&DataKey::LastAction(user.clone(), action), &now);

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

    pub fn reward_message(env: Env, user: Address) -> Result<(), ContractError> {
        let (old_level, new_level) = award_xp(&env, user.clone(), XP_MESSAGE, ActionType::Message)?;

        emit_level_up(&env, user, old_level, new_level);

        Ok(())
    }

    pub fn reward_tip_received(env: Env, user: Address) -> Result<(), ContractError> {
        require_admin(&env)?;
        let (old_level, new_level) =
            award_xp(&env, user.clone(), XP_TIP_RECEIVED, ActionType::TipReceived)?;

        emit_level_up(&env, user, old_level, new_level);

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

    /// Initialize platform settings (must be called after init)
    pub fn init_platform_settings(env: Env, fee_percentage: u32, fee_token: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

        if fee_percentage > 10000 {
            panic!("fee percentage cannot exceed 100%");
        }

        let settings = PlatformSettings {
            fee_percentage,
            admin_address: admin,
            fee_token,
        };

        env.storage().instance().set(&DataKey::PlatformSettings, &settings);
    }

    pub fn get_platform_settings(env: Env) -> PlatformSettings {
        env.storage().instance().get(&DataKey::PlatformSettings).expect("platform settings not initialized")
    }

    pub fn update_fee_percentage(env: Env, new_fee_percentage: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

        if new_fee_percentage > 10000 {
            panic!("fee percentage cannot exceed 100%");
        }

        let mut settings: PlatformSettings = env.storage().instance().get(&DataKey::PlatformSettings).expect("platform settings not initialized");
        settings.fee_percentage = new_fee_percentage;
        env.storage().instance().set(&DataKey::PlatformSettings, &settings);
    }

    pub fn collect_fee(env: Env, amount: i128) {
        let settings: PlatformSettings = env.storage().instance().get(&DataKey::PlatformSettings).expect("platform settings not initialized");
        let fee_amount = (amount * settings.fee_percentage as i128) / 10000;

        let mut treasury_balance: i128 = env.storage().instance().get(&DataKey::Treasury).unwrap_or(0);
        treasury_balance += fee_amount;
        env.storage().instance().set(&DataKey::Treasury, &treasury_balance);

        let mut total_collected: i128 = env.storage().instance().get(&DataKey::TotalFeesCollected).unwrap_or(0);
        total_collected += fee_amount;
        env.storage().instance().set(&DataKey::TotalFeesCollected, &total_collected);
    }

    pub fn withdraw_fees(env: Env, amount: i128, recipient: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

        if amount <= 0 {
            panic!("withdrawal amount must be positive");
        }

        let mut treasury_balance: i128 = env.storage().instance().get(&DataKey::Treasury).unwrap_or(0);
        if amount > treasury_balance {
            panic!("insufficient treasury balance");
        }

        let settings: PlatformSettings = env.storage().instance().get(&DataKey::PlatformSettings).expect("platform settings not initialized");
        let token_client = token::Client::new(&env, &settings.fee_token);
        token_client.transfer(&env.current_contract_address(), &recipient, &amount);

        treasury_balance -= amount;
        env.storage().instance().set(&DataKey::Treasury, &treasury_balance);

        let mut total_withdrawn: i128 = env.storage().instance().get(&DataKey::TotalFeesWithdrawn).unwrap_or(0);
        total_withdrawn += amount;
        env.storage().instance().set(&DataKey::TotalFeesWithdrawn, &total_withdrawn);
    }

    pub fn get_treasury_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Treasury).unwrap_or(0)
    }

    pub fn get_total_fees_collected(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalFeesCollected).unwrap_or(0)
    }

    pub fn get_total_fees_withdrawn(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalFeesWithdrawn).unwrap_or(0)
    }

    pub fn get_treasury_analytics(env: Env) -> TreasuryAnalytics {
        let settings: PlatformSettings = env.storage().instance().get(&DataKey::PlatformSettings).expect("platform settings not initialized");
        TreasuryAnalytics {
            current_balance: env.storage().instance().get(&DataKey::Treasury).unwrap_or(0),
            total_collected: env.storage().instance().get(&DataKey::TotalFeesCollected).unwrap_or(0),
            total_withdrawn: env.storage().instance().get(&DataKey::TotalFeesWithdrawn).unwrap_or(0),
            fee_percentage: settings.fee_percentage,
        }
    }

    pub fn calculate_fee(env: Env, amount: i128) -> i128 {
        let settings: PlatformSettings = env.storage().instance().get(&DataKey::PlatformSettings).expect("platform settings not initialized");
        (amount * settings.fee_percentage as i128) / 10000
    }

    pub fn update_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);

        // Update admin in platform settings if initialized
        if env.storage().instance().has(&DataKey::PlatformSettings) {
             let mut settings: PlatformSettings = env.storage().instance().get(&DataKey::PlatformSettings).unwrap();
             settings.admin_address = new_admin;
             env.storage().instance().set(&DataKey::PlatformSettings, &settings);
        }
    }

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
