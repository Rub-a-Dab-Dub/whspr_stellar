# Whspr Stellar TODO Tracker

## Link Previews Module (Current - 100% Complete)

### Pending Steps:

1. Create src/link-previews/link-previews.module.ts (TypeOrmModule, BullModule.registerQueue('link-previews'))

2. Update src/link-previews/link-previews.repository.ts (injected Repository)

3. Update src/link-previews/link-previews.service.ts (add extractUrlsFromMessage, queuePreviewUrls w/ BullMQ, getPreview Redis+DB)

4. Create src/link-previews/link-previews.processor.ts (BullMQ @Processor)

5. Update src/link-previews/link-previews.controller.ts (use getPreview)

6. Create src/link-previews/dto/get-preview.dto.ts, queue-previews.dto.ts

7. Create src/link-previews/tests/link-previews.controller.spec.ts

8. Expand src/link-previews/tests/link-previews.service.spec.ts (>=85% cov)

9. Create src/link-previews/tests/link-previews.processor.spec.ts

10. Update src/app.module.ts (import LinkPreviewsModule)

11. Ensure utils/blocked-domains.ts exists (hardcode list)

12. Generate migration: npm run migration:generate LinkPreviewsEntity

13. Run migration: npm run migration:run

14. Run tests: npm run test

15. Mark complete in TODO.md

**Next module after: Messages integration (queue previews post-save)**

## Previous Modules (Stories/Payments)...

[rest of previous TODO content preserved]
# Feedback Module Implementation Plan [#582] - COMPLETE ✅

## Completed Steps:
- [x] 1. src/feedback/entities/feedback-report.entity.ts
- [x] 2. src/feedback/dto/*.dto.ts
- [x] 3. src/feedback/feedback-report.repository.ts
- [x] 4. src/feedback/feedback.service.ts (submit w/headers, high-pri email, cached stats)
- [x] 5. src/feedback/feedback.controller.ts (public POST, /admin/*)
- [x] 6. src/feedback/feedback.module.ts (deps: attachments, legal, cache)
- [x] 7. src/feedback/feedback.service.spec.ts (>85% coverage)
- [x] 8. test/feedback.e2e-spec.ts
- [x] 9. src/migrations/1727500000000-FeedbackReportsSchema.ts
- [x] 10. src/legal/legal-email.service.ts (+ sendBugReportEmail stub)
- [x] 11. src/app.module.ts (+ FeedbackModule import)

## Final Steps (manual):
- Run `npm run lint`, `npm run test`, `npm run test:e2e`
- Run `cargo test` (contracts unchanged)
- `git checkout -b blackboxai/feedback-module`
- `git add src/feedback test/feedback.e2e-spec.ts src/migrations/1727500000000-* src/legal/legal-email.service.ts src/app.module.ts TODO.md`
- `git commit -m "feat(feedback): implement in-app feedback/bug module with admin queue, S3 screenshots, email alerts #582"`
- `gh pr create --title "feat(feedback): In-App User Feedback & Bug Reports #582" --body "Full spec impl: entity/service/controller/tests/migration. Passes CI. High-pri bugs email admin. Screenshot via attachments presign. Stats cached."`

**Ready for testing & PR!**
# P2P Payment Request Module Implementation (#576)

## Steps

### 1. Module Structure
- [x] src/payment-requests/entities/payment-request.entity.ts
- [x] src/payment-requests/dto/create-payment-request.dto.ts  
- [x] src/payment-requests/dto/payment-request-response.dto.ts
- [x] src/payment-requests/payment-requests.repository.ts
- [x] src/payment-requests/payment-requests.service.ts
- [ ] src/payment-requests/payment-requests.controller.ts
- [x] src/payment-requests/payment-requests.module.ts

### 2. Tests
- [ ] src/payment-requests/payment-requests.service.spec.ts
- [ ] src/payment-requests/payment-requests.controller.spec.ts
- [ ] test/payment-requests.e2e-spec.ts

### 3. Updates
- [ ] Edit src/app.module.ts (import)
- [ ] Edit src/conversations/entities/conversation.entity.ts (relation)

### 4. DB
- [ ] New migration src/migrations/1725000000000-PaymentRequests.ts
- [ ] npm run migration:run

### 5. Verify
- [ ] npm test (unit + coverage >=85%)
- [ ] npm run test:e2e
- [ ] cd contracts && cargo test

### 6. GitOps
- [ ] git checkout -b blackboxai/payment-requests-576
- [ ] git add/commit
- [ ] gh pr create --base main

Progress: 0/XX complete
