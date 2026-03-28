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
