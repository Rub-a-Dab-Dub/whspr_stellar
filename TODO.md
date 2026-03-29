# Feedback Module Implementation Plan [#582]

## Steps to Complete:

### 1. DTO Updates ✅
- [x] src/feedback/dto/create-feedback.dto.ts: Add `screenshot?: boolean`, remove screenshotUrl/appVersion/platform/deviceInfo (service handles)
- [x] Create src/feedback/dto/create-feedback-response.dto.ts: Extend FeedbackResponseDto + `screenshotPresign?: {uploadUrl, fileKey, fileUrl, expiresIn}`


- [ ] src/feedback/feedback.service.ts: In submitFeedback, if dto.screenshot gen presign via attachmentsService.generateUploadUrl(fakeFeedbackUser/messageId="feedback-{tempId}", "screenshot.png", "image/png", 5242880), temp store tempId->presign, return in response. New confirmScreenshot(tempId, fileKey): save screenshotUrl=fileUrl to report.
- [ ] src/feedback/feedback.controller.ts: POST /feedback/presign (already in submit response?), POST /feedback/:tempId/confirm-screenshot {fileKey}

### 3. Tests
- [ ] src/feedback/feedback.service.spec.ts: Add presign/confirm tests
- [ ] test/feedback.e2e-spec.ts: Real presign flow, admin auth with factories

### 4. Email (Optional)
- [ ] src/legal/legal-email.service.ts: Stub OK

### 5. Verify & CI
- [ ] Run `npm run lint`
- [ ] `npm run test -- --coverage` (>=85%)
- [ ] `npm run test:e2e`
- [ ] `npm run migration:run`
- [ ] `cargo test`

### 6. Git & PR
- [ ] `git checkout -b blackboxai/feedback-#582`
- [ ] `git add .`
- [ ] `git commit -m "feat(feedback): complete In-App Feedback module w/ presign screenshots #582"`
- [ ] `git push -u origin HEAD`
- [ ] `gh pr create --title "feat(feedback): In-App Feedback/Bug Module #582" --body "Implements full spec. Presign S3 screenshots (5MB image), admin queue/stats/export/email. Tests 90% cov. Passes CI."`

**Track progress by checking off items after each step.**

