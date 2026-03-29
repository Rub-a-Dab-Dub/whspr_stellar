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

