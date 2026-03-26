/**
 * TTL strategy per resource type (in seconds).
 * Tune these values to match data-freshness requirements per module.
 */
export const CACHE_TTL = {
  /** User profile — changes infrequently */
  USER: 300,             // 5 min
  /** User settings */
  USER_SETTINGS: 300,    // 5 min
  /** Group / conversation membership list — moderately dynamic */
  GROUP_MEMBERS: 120,    // 2 min
  /** Conversation metadata */
  CONVERSATION: 180,     // 3 min
  /** Message list per conversation — high write rate, short TTL */
  MESSAGES: 30,          // 30 s
  /** Wallet balance — financial data, kept fresh */
  WALLET: 60,            // 1 min
  /** Analytics aggregates — expensive to compute, slow to change */
  ANALYTICS: 600,        // 10 min
  /** Referral stats */
  REFERRAL: 300,         // 5 min
  /** Token price feed */
  TOKEN_PRICE: 60,       // 1 min
  /** Generic short-lived cache */
  SHORT: 60,             // 1 min
  /** Generic long-lived cache */
  LONG: 3600,            // 1 h
} as const;

export type CacheTtlKey = keyof typeof CACHE_TTL;

// ─── Key namespace builders ───────────────────────────────────────────────────
// Convention: <module>:<id>[:<sub-resource>]

export const CacheKey = {
  user: (id: string) => `user:${id}`,
  userSettings: (id: string) => `user:${id}:settings`,
  wallet: (userId: string) => `wallet:${userId}`,
  conversation: (id: string) => `conversation:${id}`,
  conversationMessages: (id: string, page: number) => `conversation:${id}:messages:${page}`,
  groupMembers: (groupId: string) => `group:${groupId}:members`,
  analytics: (scope: string) => `analytics:${scope}`,
  referral: (userId: string) => `referral:${userId}`,
  tokenPrice: (symbol: string) => `token:${symbol}:price`,
  /** Wildcard pattern for scanning by prefix */
  pattern: (prefix: string) => `${prefix}:*`,
} as const;

/** Redis key used to acquire a distributed lock for a given resource */
export const lockKey = (resource: string) => `lock:${resource}`;