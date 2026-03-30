import { BadgeKey, BadgeTier } from './entities/badge.entity';

/** Canonical badge definitions — seeded on app startup via BadgeService.seed(). */
export const BADGE_DEFINITIONS = [
  {
    key: BadgeKey.FIRST_TRANSFER,
    name: 'First Transfer',
    description: 'Awarded for completing your first token transfer.',
    tier: BadgeTier.BRONZE,
    iconUrl: null,
    criteria: {
      description: 'Complete at least 1 outgoing token transfer.',
      minTransfers: 1,
    },
  },
  {
    key: BadgeKey.TOP_REFERRER,
    name: 'Top Referrer',
    description: 'Awarded for successfully referring 5 or more users.',
    tier: BadgeTier.GOLD,
    iconUrl: null,
    criteria: {
      description: 'Refer at least 5 users who complete registration.',
      minReferrals: 5,
    },
  },
  {
    key: BadgeKey.CHAT_CHAMPION,
    name: 'Chat Champion',
    description: 'Awarded for sending 100 or more messages.',
    tier: BadgeTier.SILVER,
    iconUrl: null,
    criteria: {
      description: 'Send at least 100 messages across any rooms.',
      minMessages: 100,
    },
  },
  {
    key: BadgeKey.DAO_VOTER,
    name: 'DAO Voter',
    description: 'Awarded for casting your first DAO governance vote.',
    tier: BadgeTier.SILVER,
    iconUrl: null,
    criteria: {
      description: 'Cast at least 1 vote in a DAO proposal.',
      minVotes: 1,
    },
  },
  {
    key: BadgeKey.EARLY_ADOPTER,
    name: 'Early Adopter',
    description: 'Awarded to users who joined during the platform launch period.',
    tier: BadgeTier.GOLD,
    iconUrl: null,
    criteria: {
      description: 'Register before the early-adopter cutoff date.',
      cutoffDate: '2025-01-01T00:00:00.000Z',
    },
  },
  {
    key: BadgeKey.CRYPTO_WHALE,
    name: 'Crypto Whale',
    description: 'Awarded for transferring 10,000 or more tokens in a single transaction.',
    tier: BadgeTier.PLATINUM,
    iconUrl: null,
    criteria: {
      description: 'Complete a single transfer of at least 10,000 tokens.',
      minSingleTransferAmount: 10000,
    },
  },
  {
    key: BadgeKey.GROUP_FOUNDER,
    name: 'Group Founder',
    description: 'Awarded for creating your first group chat.',
    tier: BadgeTier.BRONZE,
    iconUrl: null,
    criteria: {
      description: 'Create at least 1 group chat room.',
      minGroupsCreated: 1,
    },
  },
] as const;
