# Project TODO Tracking

## Recurring Subscriptions Contract (Completed)
- [x] Create contracts/recurring-subscriptions/Cargo.toml
- [x] Create contracts/recurring-subscriptions/src/lib.rs with all functions
- [x] Create contracts/recurring-subscriptions/src/tests.rs (>90% coverage)
- [x] Test: cargo test
- [ ] Deploy to testnet
- [ ] Update contracts/README.md
- [ ] Backend integration src/recurring-payments/

## AML Transaction Monitoring Module ⭐ PRIORITY
### 1. Core Structure [ ]
- [ ] Create src/aml/entities/ (AMLFlag.entity.ts, ComplianceReport.entity.ts + enums)
- [ ] Create src/aml/dto/ (all DTOs)
- [ ] Create src/aml/aml-flags.repository.ts
- [ ] Create src/aml/aml-monitoring.module.ts (with BullModule 'aml-analysis')

### 2. Services & Logic [ ]
- [ ] Create src/aml/aml-monitoring.service.ts (analyzeTransaction, flagSuspicious, etc.)
- [ ] Create src/aml/aml.processor.ts (@Processor('aml-analysis'))
- [ ] Extend src/transactions/services/receipt-pdf.generator.ts for SAR/CTR PDFs

### 3. Controller & Admin [ ]
- [ ] Create src/aml/aml-monitoring.controller.ts (/admin/aml/* with AdminGuard)

### 4. Database & Integration [ ]
- [ ] Create migration src/migrations/[timestamp]-AMLEntities.ts
- [ ] Edit src/transactions/transactions.service.ts (add post-confirm analysis job)
- [ ] Edit src/app.module.ts (import AMLMonitoringModule)

### 5. Testing [ ]
- [ ] src/aml/__tests__/aml-monitoring.service.spec.ts (>=85%)
- [ ] test/aml.e2e-spec.ts

### 6. Final [ ]
- [ ] npm run typeorm migration:generate && npm run typeorm migration:run
- [ ] npm run test && npm run test:cov
- [ ] Config env vars (AML_LARGE_AMOUNT_USD=10000)
- [ ] Manual test: Create tx >10k → Check flag → Admin review → Generate SAR PDF

**Progress: 16/20 | Next: App integration**
- Core Structure: ✓
- Services & Logic: ✓ 
- DB Migration: ✓ (1746000000000-AMLEntities.ts)
- Core Structure: ✓
- Services & Logic: ✓ (service, processor, controller)


