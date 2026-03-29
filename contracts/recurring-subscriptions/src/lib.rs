 #![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone)]
pub enum Status {
    Active,
    Paused,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct Subscription {
    pub subscriber: Address,
    pub merchant: Address,
    pub token: Address,
    pub amount: i128,
    pub interval: u64,
    pub next_payment_due: u64,
    pub total_paid: i128,
    pub status: Status,
}

#[contracttype]
pub enum DataKey {
    SubscriptionsMap,
    NextSubscriptionId,
    Initialized,
}

pub type SubscriptionId = BytesN!32;

#[contract]
pub struct RecurringSubscriptionsContract;

#[contractimpl]
impl RecurringSubscriptionsContract {
    pub fn initialize(env: &Env) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::NextSubscriptionId, &0u32);
    }

    pub fn subscribe(
        env: &Env,
        merchant: Address,
        token: Address,
        amount: i128,
        interval: u64,
    ) -> SubscriptionId {
        let caller = env.invoker();
        caller.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }
        if interval == 0 {
            panic!("interval must be positive");
        }
        if caller == merchant {
            panic!("cannot subscribe to self");
        }

        let now = env.block().timestamp().u64();
        let mut next_id: u32 = env.storage().instance().get(&DataKey::NextSubscriptionId).unwrap_or(0);
        let id = SubscriptionId::from_array(&env, &next_id.to_be_bytes());
        next_id += 1;
        env.storage().instance().set(&DataKey::NextSubscriptionId, &next_id);

        let sub = Subscription {
            subscriber: caller.clone(),
            merchant,
            token,
            amount,
            interval,
            next_payment_due: now + interval,
            total_paid: 0,
            status: Status::Active,
        };

        let subs_map = env.storage().instance().get(&DataKey::SubscriptionsMap).unwrap_or(Vec::new(&env));
        let mut subs_vec = subs_map.iter().map(|v| v.unwrap());
        subs_vec.push(id.clone());
        env.storage().instance().set(&DataKey::SubscriptionsMap, &subs_vec);

        env.storage().persistent().set(&id, &sub);

        env.events().publish(
            (symbol_short!("subscribe"), caller, merchant.clone()),
            (id.clone(), token, amount, interval),
        );

        id
    }

    pub fn charge(env: &Env, id: SubscriptionId) {
        let sub: Subscription = env.storage().persistent().get(&id).expect("subscription not found");
        let caller = env.invoker();
        caller.require_auth();

        if sub.merchant != caller {
            panic!("only merchant can charge");
        }
        if !matches!(sub.status, Status::Active) {
            panic!("subscription not active");
        }
        let now = env.block().timestamp().u64();
        if now < sub.next_payment_due {
            panic!("payment not due yet");
        }

        // Transfer payment
        let client = token::Client::new(env, &sub.token);
        client.transfer(&sub.subscriber, &sub.merchant, &sub.amount);

        // Update subscription
        let mut updated = sub.clone();
        updated.next_payment_due += sub.interval;
        updated.total_paid += sub.amount;
        env.storage().persistent().set(&id, &updated);

        env.events().publish(
            (symbol_short!("charge"), sub.subscriber.clone(), sub.merchant.clone()),
            (id.clone(), sub.amount, updated.total_paid),
        );
    }

    pub fn pause(env: &Env, id: SubscriptionId) {
        let caller = env.invoker();
        let sub: Subscription = env.storage().persistent().get(&id).expect("subscription not found");
        caller.require_auth();
        if sub.subscriber != caller {
            panic!("only subscriber can pause");
        }
        if !matches!(sub.status, Status::Active) {
            panic!("cannot pause non-active subscription");
        }

        let mut updated = sub.clone();
        updated.status = Status::Paused;
        env.storage().persistent().set(&id, &updated);

        env.events().publish(
            (symbol_short!("pause"), caller),
            id,
        );
    }

    pub fn resume(env: &Env, id: SubscriptionId) {
        let caller = env.invoker();
        let sub: Subscription = env.storage().persistent().get(&id).expect("subscription not found");
        caller.require_auth();
        if sub.subscriber != caller {
            panic!("only subscriber can resume");
        }
        if !matches!(sub.status, Status::Paused) {
            panic!("cannot resume non-paused subscription");
        }

        let mut updated = sub.clone();
        updated.status = Status::Active;
        env.storage().persistent().set(&id, &updated);

        env.events().publish(
            (symbol_short!("resume"), caller),
            id,
        );
    }

    pub fn cancel(env: &Env, id: SubscriptionId) {
        let caller = env.invoker();
        let sub: Subscription = env.storage().persistent().get(&id).expect("subscription not found");
        caller.require_auth();
        if sub.subscriber != caller {
            panic!("only subscriber can cancel");
        }

        let mut updated = sub.clone();
        updated.status = Status::Cancelled;
        env.storage().persistent().set(&id, &updated);

        env.events().publish(
            (symbol_short!("cancel"), caller),
            id,
        );
    }

    pub fn is_due(env: &Env, id: SubscriptionId) -> bool {
        let sub_opt = env.storage().persistent().get(&id);
        match sub_opt {
            Some(sub) => {
                matches!(sub.status, Status::Active) && env.block().timestamp().u64() >= sub.next_payment_due
            }
            None => false,
        }
    }

    pub fn get_subscription(env: &Env, id: SubscriptionId) -> Option<Subscription> {
        env.storage().persistent().get(&id)
    }
}

