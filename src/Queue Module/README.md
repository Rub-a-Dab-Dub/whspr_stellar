# NestJS BullMQ Queue Module (example)

This repository contains a minimal NestJS app that demonstrates how to wire BullMQ queues, workers, and a BullBoard admin UI.

Quickstart

1. Install dependencies:

```powershell
npm install
```

2. Ensure Redis is running (default localhost:6379) or set REDIS_HOST/REDIS_PORT.

3. Run tests:

```powershell
npm test
```

4. Start the app:

```powershell
npm start
```

Visit http://localhost:3000/admin/queues for the BullBoard UI (placeholder in this demo).

Notes
- This sample focuses on queue wiring and worker tests. Production needs: auth for admin UI, proper DLQ wiring, and integrating real external services (email provider, blockchain node, media processor).
