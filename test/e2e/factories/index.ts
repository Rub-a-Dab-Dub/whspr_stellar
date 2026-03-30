import { createHash, randomUUID } from 'crypto';

export const AUTH_WALLETS = {
  primary: 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM',
  secondary: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA6PELEB7YX3VQXSK4B7BIFQ2TUV',
  tertiary: 'GCFXK4TL6NJ3PMHUOT6RPE3X4MZWE4X5M5RXEF6FCZ7MGRW5J5Y5M3VE',
  admin: 'GDNQFQ6V4W3M6QXPS3A2G7F7N4ABQ2CTN4YQUMR6SYT4IH6M7NQW2Q3A',
} as const;

export const SIGNATURE = 'test-signature';

function uniqueSuffix(): string {
  return createHash('sha1').update(randomUUID()).digest('hex').slice(0, 12);
}

export const UserFactory = {
  build(overrides: Partial<Record<string, unknown>> = {}) {
    const suffix = uniqueSuffix();
    return {
      walletAddress:
        (overrides.walletAddress as string | undefined) ??
        `0x${uniqueSuffix().padEnd(40, '0').slice(0, 40)}`,
      username: (overrides.username as string | undefined) ?? `user_${suffix}`,
      email: (overrides.email as string | undefined) ?? `user_${suffix}@example.com`,
      displayName: (overrides.displayName as string | undefined) ?? `E2E User ${suffix}`,
      bio: (overrides.bio as string | undefined) ?? `Generated test user ${suffix}`,
      preferredLocale: (overrides.preferredLocale as string | undefined) ?? 'en',
      ...overrides,
    };
  },
};

export const WebhookFactory = {
  build(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      url: (overrides.url as string | undefined) ?? 'https://example.invalid/webhooks/test',
      events: (overrides.events as string[] | undefined) ?? ['transfer.completed', 'user.updated'],
      secret: (overrides.secret as string | undefined) ?? uniqueSuffix().padEnd(32, 'x'),
      isActive: (overrides.isActive as boolean | undefined) ?? true,
      ...overrides,
    };
  },
};
