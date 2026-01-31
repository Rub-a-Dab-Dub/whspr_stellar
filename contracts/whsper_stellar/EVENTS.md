# Whspr Stellar Contract Events Documentation

## Overview
This document describes all events emitted by the Whspr Stellar smart contract. Events enable off-chain tracking, indexing, and real-time monitoring of contract state changes.

## Event List

### 1. User Registration Events

#### `user_registered`
Emitted when a new user registers on the platform.

**Topics:**
- `event_name`: "user_registered"
- `user`: Address of the registered user

**Data:**
- `username`: Symbol - The chosen username
- `timestamp`: u64 - Registration timestamp

**Example:**
```rust
env.events().publish(
    (Symbol::new(&env, "user_registered"), user),
    (username, env.ledger().timestamp()),
);
```

**Use Cases:**
- Track new user registrations
- Build user analytics dashboards
- Send welcome notifications
- Update user count metrics

---

#### `username_updated`
Emitted when a user changes their username.

**Topics:**
- `event_name`: "username_updated"
- `user`: Address of the user

**Data:**
- `old_username`: Symbol - Previous username
- `new_username`: Symbol - New username

**Example:**
```rust
env.events().publish(
    (Symbol::new(&env, "username_updated"), user),
    (old_username, new_username),
);
```

**Use Cases:**
- Track username changes
- Update user profiles in frontend
- Audit trail for username history
- Prevent username squatting

---

### 2. XP and Level Events

#### `xp_changed`
Emitted when a user's XP changes (from any source).

**Topics:**
- `event_name`: "xp_changed"
- `user`: Address of the user

**Data:**
- `old_xp`: u64 - Previous XP amount
- `new_xp`: u64 - New XP amount
- `xp_amount`: u64 - Amount of XP added

**Example:**
```rust
env.events().publish(
    (Symbol::new(env, "xp_changed"), user.clone()),
    (old_xp, profile.xp, xp_amount),
);
```

**Use Cases:**
- Real-time XP tracking
- Progress bars in UI
- Leaderboard updates
- Achievement tracking

---

#### `level_up`
Emitted when a user levels up.

**Topics:**
- `event_name`: "level_up"
- `user`: Address of the user

**Data:**
- `old_level`: u32 - Previous level
- `new_level`: u32 - New level

**Example:**
```rust
env.events().publish(
    (Symbol::new(env, "level_up"), user),
    (old_level, new_level),
);
```

**Use Cases:**
- Trigger level-up animations
- Send congratulations notifications
- Award level-based badges
- Update user rankings

---

### 3. Treasury and Fee Events

#### `fee_collected`
Emitted when platform fees are collected.

**Topics:**
- `event_name`: "fee_collected"

**Data:**
- `fee_amount`: i128 - Amount of fee collected
- `treasury_balance`: i128 - New treasury balance after collection
- `timestamp`: u64 - Collection timestamp

**Example:**
```rust
env.events().publish(
    (Symbol::new(&env, "fee_collected"),),
    (fee_amount, treasury_balance, env.ledger().timestamp()),
);
```

**Use Cases:**
- Track revenue generation
- Build financial analytics
- Monitor fee collection patterns
- Audit trail for accounting

---

#### `treasury_withdrawal`
Emitted when admin withdraws fees from treasury.

**Topics:**
- `event_name`: "treasury_withdrawal"
- `admin`: Address of the admin performing withdrawal
- `recipient`: Address receiving the funds

**Data:**
- `amount`: i128 - Amount withdrawn
- `remaining_balance`: i128 - Treasury balance after withdrawal
- `timestamp`: u64 - Withdrawal timestamp

**Example:**
```rust
env.events().publish(
    (Symbol::new(&env, "treasury_withdrawal"), admin, recipient),
    (amount, treasury_balance, env.ledger().timestamp()),
);
```

**Use Cases:**
- Audit trail for withdrawals
- Financial reporting
- Alert on large withdrawals
- Track fund distribution

---

### 4. Admin and Settings Events

#### `admin_changed`
Emitted when the admin address is updated.

**Topics:**
- `event_name`: "admin_changed"

**Data:**
- `old_admin`: Address - Previous admin address
- `new_admin`: Address - New admin address
- `timestamp`: u64 - Change timestamp

**Example:**
```rust
env.events().publish(
    (Symbol::new(&env, "admin_changed"),),
    (old_admin, new_admin, env.ledger().timestamp()),
);
```

**Use Cases:**
- Security monitoring
- Admin change notifications
- Governance tracking
- Access control auditing

---

#### `fee_percentage_updated`
Emitted when the platform fee percentage changes.

**Topics:**
- `event_name`: "fee_percentage_updated"
- `admin`: Address of the admin making the change

**Data:**
- `old_fee_percentage`: u32 - Previous fee percentage (basis points)
- `new_fee_percentage`: u32 - New fee percentage (basis points)
- `timestamp`: u64 - Update timestamp

**Example:**
```rust
env.events().publish(
    (Symbol::new(&env, "fee_percentage_updated"), admin),
    (old_fee_percentage, new_fee_percentage, env.ledger().timestamp()),
);
```

**Use Cases:**
- Track fee structure changes
- Notify users of fee updates
- Financial planning
- Governance transparency

---

### 5. Token Transfer Events

#### `transfer`
Emitted when P2P token transfers occur (already implemented).

**Topics:**
- `event_name`: "transfer"
- `sender`: Address of the sender
- `recipient`: Address of the recipient

**Data:**
- `token`: Address - Token contract address
- `amount`: i128 - Transfer amount

**Example:**
```rust
env.events().publish(
    (Symbol::new(&env, "transfer"), sender, recipient),
    (token, amount),
);
```

**Use Cases:**
- Track token movements
- Build transaction history
- Monitor transfer patterns
- Wallet balance updates

---

## Event Indexing Guide

### Listening to Events

Events can be monitored using Stellar's event streaming:

```javascript
// Example using Stellar SDK
const server = new SorobanRpc.Server(rpcUrl);

// Subscribe to contract events
server.getEvents({
  startLedger: startLedger,
  filters: [
    {
      type: "contract",
      contractIds: [contractId],
    }
  ]
}).then(events => {
  events.forEach(event => {
    console.log("Event:", event);
  });
});
```

### Event Filtering

Filter events by topic:

```javascript
// Filter for user registration events
const registrationEvents = events.filter(e => 
  e.topic[0] === "user_registered"
);

// Filter for specific user's XP changes
const userXpEvents = events.filter(e => 
  e.topic[0] === "xp_changed" && 
  e.topic[1] === userAddress
);

// Filter for treasury operations
const treasuryEvents = events.filter(e => 
  e.topic[0] === "fee_collected" || 
  e.topic[0] === "treasury_withdrawal"
);
```

### Building an Indexer

Example indexer structure:

```javascript
class WhsprEventIndexer {
  async indexEvents(fromLedger, toLedger) {
    const events = await this.fetchEvents(fromLedger, toLedger);
    
    for (const event of events) {
      switch (event.topic[0]) {
        case "user_registered":
          await this.handleUserRegistration(event);
          break;
        case "xp_changed":
          await this.handleXpChange(event);
          break;
        case "level_up":
          await this.handleLevelUp(event);
          break;
        case "fee_collected":
          await this.handleFeeCollection(event);
          break;
        case "treasury_withdrawal":
          await this.handleTreasuryWithdrawal(event);
          break;
        case "admin_changed":
          await this.handleAdminChange(event);
          break;
        case "fee_percentage_updated":
          await this.handleFeeUpdate(event);
          break;
        case "username_updated":
          await this.handleUsernameUpdate(event);
          break;
      }
    }
  }
}
```

## Analytics Use Cases

### User Growth Tracking
Monitor `user_registered` events to track:
- Daily/weekly/monthly new users
- Registration trends
- User acquisition metrics

### Revenue Analytics
Monitor `fee_collected` and `treasury_withdrawal` events to track:
- Total revenue generated
- Fee collection patterns
- Withdrawal frequency
- Treasury balance over time

### User Engagement
Monitor `xp_changed` and `level_up` events to track:
- Active users
- User progression
- Engagement levels
- Retention metrics

### Governance Monitoring
Monitor `admin_changed` and `fee_percentage_updated` events to track:
- Admin changes
- Policy updates
- Governance decisions

## Real-Time Notifications

### Frontend Integration

```javascript
// React example
useEffect(() => {
  const eventStream = subscribeToEvents(contractId);
  
  eventStream.on('level_up', (event) => {
    showNotification(`Congratulations! You reached level ${event.data.new_level}!`);
  });
  
  eventStream.on('xp_changed', (event) => {
    updateXpBar(event.data.new_xp);
  });
  
  return () => eventStream.close();
}, []);
```

### Push Notifications

```javascript
// Backend notification service
eventIndexer.on('level_up', async (event) => {
  await sendPushNotification(event.user, {
    title: "Level Up!",
    body: `You've reached level ${event.data.new_level}!`,
  });
});

eventIndexer.on('treasury_withdrawal', async (event) => {
  if (event.data.amount > LARGE_WITHDRAWAL_THRESHOLD) {
    await alertAdmins({
      type: "large_withdrawal",
      amount: event.data.amount,
      admin: event.admin,
    });
  }
});
```

## Event Data Types

### Basis Points
Fee percentages are stored in basis points (1 basis point = 0.01%):
- 100 = 1%
- 500 = 5%
- 1000 = 10%
- 10000 = 100%

### Timestamps
All timestamps are Unix timestamps (seconds since epoch) from `env.ledger().timestamp()`.

### Addresses
All addresses are Stellar addresses in the standard format.

## Best Practices

1. **Always index events sequentially** - Process events in ledger order to maintain consistency
2. **Handle reorgs** - Be prepared for ledger reorganizations
3. **Cache event data** - Store processed events to avoid reprocessing
4. **Monitor event gaps** - Detect and handle missing events
5. **Rate limit queries** - Don't overwhelm RPC nodes
6. **Validate event data** - Always validate event data before processing
7. **Log errors** - Keep detailed logs of indexing errors
8. **Implement retries** - Retry failed event fetches with exponential backoff

## Testing Events

Test event emissions in your tests:

```rust
#[test]
fn test_user_registration_event() {
    let env = Env::default();
    let contract = create_contract(&env);
    
    contract.register_user(&user, &username);
    
    let events = env.events().all();
    assert_eq!(events.len(), 1);
    
    let event = &events[0];
    assert_eq!(event.topics[0], Symbol::new(&env, "user_registered"));
    assert_eq!(event.topics[1], user);
}
```

## Summary

All major state-changing operations now emit events:
- ✅ User Registration (`user_registered`)
- ✅ Username Updates (`username_updated`)
- ✅ XP Changes (`xp_changed`)
- ✅ Level Ups (`level_up`)
- ✅ Fee Collection (`fee_collected`)
- ✅ Treasury Withdrawals (`treasury_withdrawal`)
- ✅ Admin Changes (`admin_changed`)
- ✅ Settings Updates (`fee_percentage_updated`)
- ✅ Token Transfers (`transfer`)

These events enable:
- Real-time frontend updates
- Comprehensive analytics dashboards
- Audit trails for all operations
- User progression tracking
- Financial reporting
- Governance transparency
