/** Cache key builders — centralised to prevent key collisions. */
export const CacheKey = {
  user: (id: string) => `user:${id}`,
  userByWallet: (address: string) => `user:wallet:${address}`,
  room: (id: string) => `room:${id}`,
  roomMembers: (id: string) => `room:${id}:members`,
  leaderboard: (page: number) => `leaderboard:${page}`,
  contractEvents: (contractId: string, topic: string, page: number) =>
    `events:${contractId}:${topic}:${page}`,
} as const;

/** Returns all keys that should be invalidated when a user is mutated. */
export const userInvalidationKeys = (id: string, wallet: string): string[] => [
  CacheKey.user(id),
  CacheKey.userByWallet(wallet),
];
