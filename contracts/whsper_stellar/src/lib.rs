#![no_std]

use soroban_sdk::{Address, Env, Symbol, Vec, contract, contracterror, contractimpl, contracttype, token};

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
    InvalidAmount = 8,
    InsufficientBalance = 9,
    TransferLimitExceeded = 10,
    DailyCapExceeded = 11,
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
    // P2P Transfer related keys
    TransferSettings,
    DailyTransferRecord(Address),
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

/// P2P Transfer settings for security limits
#[derive(Clone)]
#[contracttype]
pub struct TransferSettings {
    pub max_transfer_amount: i128,
    pub daily_transfer_cap: i128,
}

/// Daily transfer tracking per user
#[derive(Clone)]
#[contracttype]
pub struct DailyTransferRecord {
    pub total_transferred: i128,
    pub last_reset_timestamp: u64,
}

/// Transfer event data
#[derive(Clone)]
#[contracttype]
pub struct TransferEventData {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub timestamp: u64,
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

        // Initialize default transfer settings
        let default_transfer_settings = TransferSettings {
            max_transfer_amount: 1_000_000_000_000, // Default max: 1 trillion stroops
            daily_transfer_cap: 10_000_000_000_000, // Default daily cap: 10 trillion stroops
        };
        env.storage()
            .instance()
            .set(&DataKey::TransferSettings, &default_transfer_settings);

        Ok(())
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

    pub fn update_username(env: Env, caller: Address, new_username: Symbol) -> Result<(), ContractError> {
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

    // ==================== P2P TRANSFER FUNCTIONS ====================

    /// Initialize or update transfer settings (admin only)
    pub fn init_transfer_settings(
        env: Env,
        max_transfer_amount: i128,
        daily_transfer_cap: i128,
    ) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;

        admin.require_auth();

        if max_transfer_amount <= 0 || daily_transfer_cap <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let settings = TransferSettings {
            max_transfer_amount,
            daily_transfer_cap,
        };

        env.storage()
            .instance()
            .set(&DataKey::TransferSettings, &settings);

        Ok(())
    }

    /// P2P Token Transfer - Zero Fees
    /// Transfers tokens directly from sender to recipient without any platform fees
    pub fn transfer_tokens(
        env: Env,
        sender: Address,
        recipient: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        sender.require_auth();

        // Get transfer settings
        let transfer_settings: TransferSettings = env
            .storage()
            .instance()
            .get(&DataKey::TransferSettings)
            .ok_or(ContractError::NotInitialized)?;

        // Validate amount
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        // Check transfer limits
        if amount > transfer_settings.max_transfer_amount {
            return Err(ContractError::TransferLimitExceeded);
        }

        // Check and update daily transfer cap
        let current_timestamp = env.ledger().timestamp();
        let seconds_per_day: u64 = 86400;

        let mut daily_record: DailyTransferRecord = env
            .storage()
            .instance()
            .get(&DataKey::DailyTransferRecord(sender.clone()))
            .unwrap_or(DailyTransferRecord {
                total_transferred: 0,
                last_reset_timestamp: current_timestamp,
            });

        // Reset daily cap if a day has passed
        if current_timestamp >= daily_record.last_reset_timestamp + seconds_per_day {
            daily_record.total_transferred = 0;
            daily_record.last_reset_timestamp = current_timestamp;
        }

        // Check if this transfer would exceed daily cap
        if daily_record.total_transferred + amount > transfer_settings.daily_transfer_cap {
            return Err(ContractError::DailyCapExceeded);
        }

        // Get platform settings for token address
        let platform_settings: PlatformSettings = env
            .storage()
            .instance()
            .get(&DataKey::PlatformSettings)
            .ok_or(ContractError::NotInitialized)?;

        // Create token client
        let token_client = token::Client::new(&env, &platform_settings.fee_token);

        // Check sender's balance
        let sender_balance = token_client.balance(&sender);
        if sender_balance < amount {
            return Err(ContractError::InsufficientBalance);
        }

        // Execute transfer - 100% to recipient (zero fees)
        token_client.transfer(&sender, &recipient, &amount);

        // Update daily transfer record
        daily_record.total_transferred += amount;

        env.storage()
            .instance()
            .set(&DataKey::DailyTransferRecord(sender.clone()), &daily_record);

        // Emit transfer event
        env.events().publish(
            (Symbol::new(&env, "p2p_transfer"), sender.clone(), recipient.clone()),
            TransferEventData {
                from: sender,
                to: recipient,
                amount,
                timestamp: current_timestamp,
            },
        );

        Ok(())
    }

    pub fn get_transfer_settings(env: Env) -> Result<TransferSettings, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::TransferSettings)
            .ok_or(ContractError::NotInitialized)
    }
}

fn validate_username(env: &Env, username: &Symbol) -> Result<(), ContractError> {
    // Convert symbol to string slice for validation
    // Symbol in Soroban has a max length constraint built-in
    // We validate by checking if the symbol can be represented as a short symbol (max 9 chars)
    // or a longer symbol (up to 32 chars). Empty symbols are invalid.

    // Create a test by trying to create the same symbol - if it matches, it's valid
    // For usernames, we require at least some content
    let empty_symbol = Symbol::new(env, "");
    if *username == empty_symbol {
        return Err(ContractError::InvalidUsername);
    }

    // Additional validation: usernames should be alphanumeric
    // Since we can't iterate over Symbol chars directly in no_std,
    // we trust that valid symbols passed to the contract are properly formatted
    // The frontend/client should validate username format before submission

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
