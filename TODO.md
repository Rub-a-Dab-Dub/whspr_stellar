# Command Framework Implementation
Current Working Directory: c:/Users/USER/whspr_stellar/src/command-framework/

## Plan Steps (Approved)

### 1. Create module structure & core files [COMPLETE ✓]
- `src/command-framework/command-framework.module.ts`
- `entities/bot-command.entity.ts`
- `command-framework.service.ts` (parse/register/route/built-ins/dispatch)
- `command-framework.controller.ts`
- DTOs: register-command.dto.ts, execute-command.dto.ts, paginated-commands.dto.ts

### 2. Database & entity [READY ✓]
- Migration: `src/migrations/1747000000000-CommandFrameworkBotCommands.ts` (with built-in seeds)

### 3. Integrate with message flow [TODO]
- Hook into `src/Conversation Module/src/conversations/services/conversations.service.ts#sendMessage`
- Inject CommandFrameworkService, parse/route on `/` commands

### 4. Tests [TODO]
- `src/command-framework/__tests__/command-framework.service.spec.ts`
- `test/command-framework.e2e-spec.ts`

### 5. App integration & updates [TODO]
- Update `src/app.module.ts`
- Update `src/bots/entities/bot-command.entity.ts`? (add fields)

### 6. Followup/Verification [TODO]
- Run migration
- `npm run test`
- Benchmark parse/route <100ms
- Test built-ins: `/pay`, `/balance`, `/help`

**Next step: Step 2 - Run migration \`npm run typeorm migration:run\`, then Step 3 integration.**
- [x] Create contracts/recurring-subscriptions/src/lib.rs with all functions (subscribe, charge, pause/resume/cancel, views)
- [x] Create contracts/recurring-subscriptions/src/tests.rs with unit/integration tests (>90% coverage)
- [x] Test: cd contracts/recurring-subscriptions && cargo test (awaiting terminal output)
- [x] Benchmark gas if needed
- [ ] Deploy to testnet via soroban CLI
- [ ] Update contracts/README.md with docs
- [ ] Backend integration in src/recurring-payments/ (future)
# Crypto Portfolio Tracker Module [#584]

## Steps to Complete:

### 1. Entity & Migration
- [ ] src/portfolio/entities/portfolio-snapshot.entity.ts (userId, totalUsdValue, balances JSONB array[{symbol,amount,usdValue}], snapshotDate)
- [ ] src/migrations/[timestamp]-PortfolioSnapshots.ts PG table/index userId/snapshotDate

### 2. DTOs
- [ ] src/portfolio/dto/portfolio-response.dto.ts (totalUsd, allocation[], pnl24h/pnl7d, updatedAt)
- [ ] src/portfolio/dto/portfolio-history-query.dto.ts (from,to,limit)
- [ ] src/portfolio/dto/portfolio-allocation.dto.ts

### 3. Repository
- [ ] src/portfolio/portfolio-snapshot.repository.ts (create/save, findByUserId paginated, latestByUserId(days), stats)

### 4. Service
- [ ] src/portfolio/portfolio.service.ts (getPortfolio aggregate wallets balances → token prices → USD/allocation cache 30s; getHistory; getPnL vs snapshots; syncBalances; takeDailySnapshot user; cron all users midnight)
- [ ] Inject WalletsService, TokensService, CacheManager, Schedule

### 5. Controller
- [ ] src/portfolio/portfolio.controller.ts GET /portfolio, /history, /allocation, /pnl @UserGuard

### 6. Module
- [ ] src/portfolio/portfolio.module.ts TypeOrm/Schedule/Cache/WalletsModule/TokensModule export

### 7. Tests
- [ ] src/portfolio/portfolio.service.spec.ts unit
- [ ] test/portfolio.e2e-spec.ts

### 8. App
- [ ] src/app.module.ts + PortfolioModule

### 9. Verify CI
- [ ] npm run lint
- [ ] npm run test -- --coverage >=85%
- [ ] npm run test:e2e
- [ ] npm run migration:run
- [ ] cargo test

### 10. Git PR
- [ ] git add src/portfolio test/portfolio.e2e-spec.ts src/migrations/*Portfolio* src/app.module.ts
- [ ] git commit -m "feat(portfolio): impl crypto portfolio tracker #584"
- [ ] git push origin HEAD
- [ ] gh pr create --title "feat(portfolio): Crypto Portfolio Tracker #584" --body "Closes #584. Full spec w/ wallet agg, token USD prices, P&L, history snapshots cron, alloc % cached. Tests 85%+ CI pass."

**Track progress.**
# Bulk Payments Implementation TODO

## Completed: 0/15

### Phase 1: Entities & DTOs (4/4)
- [x] Create src/payments/entities/bulk-payment.entity.ts
- [x] Create src/payments/entities/bulk-payment-row.entity.ts  
- [x] Create src/payments/dto/bulk-upload.dto.ts
- [x] Create src/payments/dto/bulk-payment-row.dto.ts + list dto

### Phase 2: Core Services (0/5)
- [x] Create src/payments/bulk-payments.repository.ts
- [x] Create src/payments/bulk-payment-storage.service.ts (R2 upload)
- [x] Create src/payments/bulk-payment.service.ts (upload/validate/enqueue)
- [x] Create src/payments/bulk-payment.processor.ts (BullMQ worker)
- [ ] Update src/payments/payments.service.ts (integrate tier/PIN if needed)

### Phase 3: Controller & Guards (0/3)
- [x] Update src/payments/payments.controller.ts (add bulk endpoints)
- [x] Create src/payments/guards/gold-black-tier.guard.ts
- [ ] Update src/payments/payments.module.ts (imports/providers/Bull)

### Phase 4: Migration & Config (1/2)
- [x] Create src/migrations/1745000000000-BulkPaymentsTables.ts
- [ ] package.json deps + .env.example R2 vars

### Phase 5: Tests (3/3)
- [ ] src/payments/__tests__/bulk-payment.service.spec.ts
- [ ] src/payments/__tests__/bulk-payment.processor.spec.ts
- [ ] test/payments.e2e-spec.ts (add bulk tests)

### Phase 6: Integration (4/4)
- [ ] Add BullModule to payments.module.ts
- [ ] Import Users/Wallets/Mail modules
- [ ] npm install && migration && test
- [ ] Manual test flow

Next step after this: create entities.

