export const PUSH_NOTIFICATION_QUEUE = 'push-notifications';

export enum PushJobName {
  SEND_TO_USER = 'send-to-user',
  SEND_TO_USERS = 'send-to-users',
  SEND_TO_TOPIC = 'send-to-topic',
  CLEANUP_INVALID_TOKENS = 'cleanup-invalid-tokens',
}

export const PUSH_QUEUE_DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};
