# E2E Test Coverage Gaps

## Covered in this suite

- Wallet-signature auth flow: challenge -> verify -> refresh -> logout
- Authenticated user profile update and retrieval
- Session listing and rotation assertions
- Wallet linking, primary-wallet switching, and balance retrieval
- In-chat transfer preview -> estimate -> confirm flow
- Webhook registration and delivery-record verification
- Admin user status toggling with access revocation checks

## Current repo gaps

- Contact request -> accept -> direct message is not currently wired into the main backend app surface
- Group creation, group messaging, treasury proposal, voting, and execution are not exposed through the current root Nest app
- Real Soroban submission is stubbed in e2e to keep the suite deterministic and CI-safe
- Real webhook HTTP delivery and BullMQ worker behavior are replaced with a deterministic e2e delivery adapter
- Email-content delivery is exercised indirectly through i18n/unit coverage, not as a backend e2e flow
- Existing repo-wide compile issues outside this suite may still block full green CI until they are fixed separately
