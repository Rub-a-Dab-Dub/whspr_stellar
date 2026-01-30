use crate::storage::DataKey;
use crate::types::{ActionType, DailyStats, RateLimitConfig};
use soroban_sdk::{Address, Env};

// Checks if an action is allowed based on limits and reputation.
pub fn check_can_act(env: &Env, user: &Address, action: ActionType) {
    // 1. Check Admin Override
    if env
        .storage()
        .instance()
        .has(&DataKey::AdminOverride(user.clone()))
    {
        if env
            .storage()
            .instance()
            .get(&DataKey::AdminOverride(user.clone()))
            .unwrap_or(false)
        {
            return; // User is exempt from limits
        }
    }

    // 2. Load Configuration
    let config: RateLimitConfig = env
        .storage()
        .instance()
        .get(&DataKey::RateLimitConfig)
        .expect("RateLimitConfig not initialized");

    // 3. Load User Reputation (Default to 0)
    let reputation: u32 = env
        .storage()
        .instance()
        .get(&DataKey::UserReputation(user.clone()))
        .unwrap_or(0);
    // Clamp reputation to 100 for calculations
    let effective_rep = if reputation > 100 { 100 } else { reputation };

    // 4. Calculate Scaled Limits (Reputation 0-100 scales cooldown down and limits up)
    let (base_cooldown, base_daily_limit) = match action {
        ActionType::Message => (config.message_cooldown, config.daily_message_limit),
        ActionType::Tip => (config.tip_cooldown, config.daily_tip_limit),
        ActionType::Transfer => (config.transfer_cooldown, config.daily_transfer_limit),
        ActionType::TipReceived => (0, u32::MAX), // No rate limit for receiving tips logic here
    };

    let scaled_cooldown = base_cooldown * (200 - effective_rep as u64) / 200;
    let scaled_daily_limit = base_daily_limit as u64 * (100 + effective_rep as u64) / 100;

    // 5. Check Cooldown
    let last_action_key = DataKey::UserLastAction(user.clone(), action);
    let current_time = env.ledger().timestamp();

    if env.storage().instance().has(&last_action_key) {
        let last_action_time: u64 = env.storage().instance().get(&last_action_key).unwrap();

        if current_time < last_action_time + scaled_cooldown {
            panic!("Rate limit exceeded: Cooldown active");
        }
    }

    // 6. Check Daily Limit
    let daily_stats_key = DataKey::UserDailyStats(user.clone());
    let mut daily_stats: DailyStats = env
        .storage()
        .instance()
        .get(&daily_stats_key)
        .unwrap_or(DailyStats::default());

    let current_day = current_time / 86400; // 86400 seconds in a day

    if daily_stats.last_day != current_day {
        // Reset stats if it's a new day
        daily_stats = DailyStats {
            message_count: 0,
            tip_count: 0,
            transfer_count: 0,
            last_day: current_day,
        };
    }

    let current_count = match action {
        ActionType::Message => daily_stats.message_count,
        ActionType::Tip => daily_stats.tip_count,
        ActionType::Transfer => daily_stats.transfer_count,
        ActionType::TipReceived => 0, // Not tracked in daily stats this way
    };

    if current_count as u64 >= scaled_daily_limit {
        panic!("Rate limit exceeded: Daily limit reached");
    }
}

// Records an action, updating timestamps and daily stats.
pub fn record_action(env: &Env, user: &Address, action: ActionType) {
    let current_time = env.ledger().timestamp();
    let current_day = current_time / 86400;

    // Update Last Action Timestamp
    let last_action_key = DataKey::UserLastAction(user.clone(), action);
    env.storage()
        .instance()
        .set(&last_action_key, &current_time);

    // Update Daily Stats
    let daily_stats_key = DataKey::UserDailyStats(user.clone());
    let mut daily_stats: DailyStats = env
        .storage()
        .instance()
        .get(&daily_stats_key)
        .unwrap_or(DailyStats::default());

    if daily_stats.last_day != current_day {
        daily_stats = DailyStats {
            message_count: 0,
            tip_count: 0,
            transfer_count: 0,
            last_day: current_day,
        };
    }

    match action {
        ActionType::Message => daily_stats.message_count += 1,
        ActionType::Tip => daily_stats.tip_count += 1,
        ActionType::Transfer => daily_stats.transfer_count += 1,
        ActionType::TipReceived => {} // Do not count towards daily limits
    }

    env.storage().instance().set(&daily_stats_key, &daily_stats);
}
