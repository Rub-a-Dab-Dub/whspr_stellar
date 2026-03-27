This minimal NestJS project demonstrates BullMQ integration with multiple queues and workers.

Features added:
- Queues: notifications, blockchain-tx, media-processing, email, event-indexing
- QueueService for enqueueing typed jobs
- Workers/processors for each queue with progress updates
- Exponential backoff with 3 attempts
- Placeholder DLQ processor
- Admin controller with BullBoard placeholder

Notes:
- Install dependencies with `npm install`.
- Start Redis locally or configure REDIS_HOST/REDIS_PORT.
- Run with `npm start`.

Further work to reach production:
- Wire BullBoard serverAdapter in app bootstrap and mount at /admin/queues
- Add auth/guards to admin endpoints
- Implement proper DLQ moveToFailed handling and dedicated DLQ queue
- Add unit tests - currently omitted to keep the patch concise
