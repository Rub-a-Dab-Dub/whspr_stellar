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

