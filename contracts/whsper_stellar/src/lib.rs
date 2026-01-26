#![no_std]

use soroban_sdk::{Address, Env, Symbol, contract, contractimpl, contracttype, token};

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

#[contractimpl]
impl BaseContract {
    pub fn init(env: Env, admin: Address, name: Symbol, version: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("contract already initialized");
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

    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized")
    }

    pub fn metadata(env: Env) -> ContractMetadata {
        env.storage()
            .instance()
            .get(&DataKey::Metadata)
            .expect("not initialized")
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
