#![no_std]

use soroban_sdk::{Address, Env, Symbol, contract, contracterror, contractimpl, contracttype, token, Vec};

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
    InsufficientBalance = 8,
    TransferLimitExceeded = 9,
    DailyCapExceeded = 10,
    InvalidAmount = 11,
    SelfTransferNotAllowed = 12,
    TransferLimitsNotInitialized = 13,
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
    TransferLimits,
    /// Tracks daily transfers for a user (Address, day_timestamp)
    UserDailyTransfer(Address, u64),
    TotalP2PTransfers,
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

/// P2P Transfer limits configuration
#[derive(Clone)]
#[contracttype]
pub struct TransferLimits {
    /// Maximum amount per single transfer
    pub max_transfer_amount: i128,
    /// Minimum amount per single transfer
    pub min_transfer_amount: i128,
    /// Maximum total amount a user can transfer per day
    pub daily_cap: i128,
    /// Whether transfers are enabled
    pub transfers_enabled: bool,
}

/// Tracks a user's daily transfer activity
#[derive(Clone)]
#[contracttype]
pub struct UserDailyTransfer {
    /// Total amount transferred today
    pub total_transferred: i128,
    /// Number of transfers made today
    pub transfer_count: u32,
    /// Day timestamp (start of day)
    pub day_timestamp: u64,
}

/// Transfer event data for indexing
#[derive(Clone)]
#[contracttype]
pub struct TransferEvent {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub token: Address,
    pub timestamp: u64,
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

    // ==================== P2P TOKEN TRANSFERS (ZERO FEES) ====================

    /// Initialize transfer limits (admin only)
    /// Must be called before transfers can be used
    pub fn init_transfer_limits(
        env: Env,
        max_transfer_amount: i128,
        min_transfer_amount: i128,
        daily_cap: i128,
    ) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;

        admin.require_auth();

        // Validate limits
        if min_transfer_amount <= 0 {
            panic!("minimum transfer amount must be positive");
        }
        if max_transfer_amount < min_transfer_amount {
            panic!("max transfer amount must be >= min transfer amount");
        }
        if daily_cap < max_transfer_amount {
            panic!("daily cap must be >= max transfer amount");
        }

        let limits = TransferLimits {
            max_transfer_amount,
            min_transfer_amount,
            daily_cap,
            transfers_enabled: true,
        };

        env.storage()
            .instance()
            .set(&DataKey::TransferLimits, &limits);

        // Initialize total P2P transfers counter
        env.storage()
            .instance()
            .set(&DataKey::TotalP2PTransfers, &0i128);

        Ok(())
    }

    /// Get current transfer limits
    pub fn get_transfer_limits(env: Env) -> Result<TransferLimits, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::TransferLimits)
            .ok_or(ContractError::TransferLimitsNotInitialized)
    }

    /// Update transfer limits (admin only)
    pub fn update_transfer_limits(
        env: Env,
        max_transfer_amount: Option<i128>,
        min_transfer_amount: Option<i128>,
        daily_cap: Option<i128>,
        transfers_enabled: Option<bool>,
    ) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;

        admin.require_auth();

        let mut limits: TransferLimits = env
            .storage()
            .instance()
            .get(&DataKey::TransferLimits)
            .ok_or(ContractError::TransferLimitsNotInitialized)?;

        if let Some(max) = max_transfer_amount {
            limits.max_transfer_amount = max;
        }
        if let Some(min) = min_transfer_amount {
            limits.min_transfer_amount = min;
        }
        if let Some(cap) = daily_cap {
            limits.daily_cap = cap;
        }
        if let Some(enabled) = transfers_enabled {
            limits.transfers_enabled = enabled;
        }

        // Validate updated limits
        if limits.min_transfer_amount <= 0 {
            panic!("minimum transfer amount must be positive");
        }
        if limits.max_transfer_amount < limits.min_transfer_amount {
            panic!("max transfer amount must be >= min transfer amount");
        }
        if limits.daily_cap < limits.max_transfer_amount {
            panic!("daily cap must be >= max transfer amount");
        }

        env.storage()
            .instance()
            .set(&DataKey::TransferLimits, &limits);

        Ok(())
    }

    /// Transfer tokens directly to another user with zero platform fees
    ///
    /// # Arguments
    /// * `sender` - The address sending tokens (must authorize the transaction)
    /// * `recipient` - The address receiving tokens
    /// * `token` - The token contract address
    /// * `amount` - The amount to transfer (100% goes to recipient, no fees)
    ///
    /// # Returns
    /// * `Ok(())` on successful transfer
    /// * `Err(ContractError)` on failure
    pub fn transfer_tokens(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        // Require sender authorization
        sender.require_auth();

        // Validate: cannot transfer to self
        if sender == recipient {
            return Err(ContractError::SelfTransferNotAllowed);
        }

        // Validate: amount must be positive
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        // Get transfer limits
        let limits: TransferLimits = env
            .storage()
            .instance()
            .get(&DataKey::TransferLimits)
            .ok_or(ContractError::TransferLimitsNotInitialized)?;

        // Check if transfers are enabled
        if !limits.transfers_enabled {
            panic!("transfers are currently disabled");
        }

        // Validate: amount within allowed range
        if amount < limits.min_transfer_amount {
            return Err(ContractError::InvalidAmount);
        }
        if amount > limits.max_transfer_amount {
            return Err(ContractError::TransferLimitExceeded);
        }

        // Check and update daily transfer cap
        let current_day = get_day_timestamp(&env);
        let daily_key = DataKey::UserDailyTransfer(sender.clone(), current_day);

        let mut daily_transfer: UserDailyTransfer = env
            .storage()
            .instance()
            .get(&daily_key)
            .unwrap_or(UserDailyTransfer {
                total_transferred: 0,
                transfer_count: 0,
                day_timestamp: current_day,
            });

        // Check if adding this transfer would exceed daily cap
        let new_daily_total = daily_transfer.total_transferred + amount;
        if new_daily_total > limits.daily_cap {
            return Err(ContractError::DailyCapExceeded);
        }

        // Create token client to check balance and perform transfer
        let token_client = token::Client::new(&env, &token);

        // Validate: sender has sufficient balance
        let sender_balance = token_client.balance(&sender);
        if sender_balance < amount {
            return Err(ContractError::InsufficientBalance);
        }

        // Perform the transfer: 100% goes to recipient (zero fees)
        token_client.transfer(&sender, &recipient, &amount);

        // Update daily transfer record
        daily_transfer.total_transferred = new_daily_total;
        daily_transfer.transfer_count += 1;
        env.storage().instance().set(&daily_key, &daily_transfer);

        // Update total P2P transfers counter
        let mut total_transfers: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalP2PTransfers)
            .unwrap_or(0);
        total_transfers += amount;
        env.storage()
            .instance()
            .set(&DataKey::TotalP2PTransfers, &total_transfers);

        // Emit transfer event
        let transfer_event = TransferEvent {
            from: sender.clone(),
            to: recipient.clone(),
            amount,
            token: token.clone(),
            timestamp: env.ledger().timestamp(),
        };

        env.events().publish(
            (Symbol::new(&env, "p2p_transfer"), sender, recipient),
            transfer_event,
        );

        Ok(())
    }

    /// Get a user's daily transfer record for the current day
    pub fn get_user_daily_transfer(
        env: Env,
        user: Address,
    ) -> UserDailyTransfer {
        let current_day = get_day_timestamp(&env);
        let daily_key = DataKey::UserDailyTransfer(user, current_day);

        env.storage()
            .instance()
            .get(&daily_key)
            .unwrap_or(UserDailyTransfer {
                total_transferred: 0,
                transfer_count: 0,
                day_timestamp: current_day,
            })
    }

    /// Get remaining daily transfer allowance for a user
    pub fn get_remaining_daily_allowance(
        env: Env,
        user: Address,
    ) -> Result<i128, ContractError> {
        let limits: TransferLimits = env
            .storage()
            .instance()
            .get(&DataKey::TransferLimits)
            .ok_or(ContractError::TransferLimitsNotInitialized)?;

        let daily = Self::get_user_daily_transfer(env, user);

        let remaining = limits.daily_cap - daily.total_transferred;
        Ok(if remaining > 0 { remaining } else { 0 })
    }

    /// Get total P2P transfer volume (lifetime)
    pub fn get_total_p2p_transfers(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalP2PTransfers)
            .unwrap_or(0)
    }
}

/// Get the start of the current day as a timestamp (seconds since epoch, rounded to day)
fn get_day_timestamp(env: &Env) -> u64 {
    let current_timestamp = env.ledger().timestamp();
    // Round down to start of day (86400 seconds = 1 day)
    (current_timestamp / 86400) * 86400
}

fn validate_username(env: &Env, username: &Symbol) -> Result<(), ContractError> {
    // Soroban Symbols have a max length of 32 characters (short) or 64 (long)
    // We validate by checking if the symbol is not empty
    // Symbol::new() will panic if the string is invalid, so basic validation is handled
    let empty_symbol = Symbol::new(env, "");
    if *username == empty_symbol {
        return Err(ContractError::InvalidUsername);
    }
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
