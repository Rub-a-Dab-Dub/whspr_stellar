/**
 * Soroban contract event topic and payload schemas.
 *
 * Topic arrays follow the Soroban convention:
 *   topics[0] = event name (Symbol)
 *   topics[1..n] = indexed filter fields (Address, i128, etc.)
 *
 * All amounts are represented as strings (i128 → string) to avoid JS bigint loss.
 */

export const CONTRACT_EVENTS = {
  // ── Messaging ──────────────────────────────────────────────────────────────
  MESSAGE_SENT: 'message_sent',
  MESSAGE_DELETED: 'message_deleted',

  // ── Tipping ────────────────────────────────────────────────────────────────
  TIP_SENT: 'tip_sent',

  // ── Rooms ──────────────────────────────────────────────────────────────────
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  ROOM_EXPIRED: 'room_expired',

  // ── P2P Transfers ──────────────────────────────────────────────────────────
  TRANSFER_SENT: 'transfer_sent',

  // ── XP / Levels ────────────────────────────────────────────────────────────
  XP_AWARDED: 'xp_awarded',
  LEVEL_UP: 'level_up',
} as const;

export type ContractEventName = (typeof CONTRACT_EVENTS)[keyof typeof CONTRACT_EVENTS];

/**
 * Typed payload schemas for each event.
 * These are the decoded `value` XDR fields after deserialization.
 */
export interface EventPayloads {
  message_sent: {
    messageId: string;
    roomId: string;
    sender: string; // Stellar address
    contentHash: string; // IPFS/Arweave CID
    timestamp: number;
  };
  message_deleted: {
    messageId: string;
    roomId: string;
    deletedBy: string;
  };
  tip_sent: {
    from: string;
    to: string;
    amount: string; // i128 as string
    token: string; // asset contract address
    platformFee: string;
    roomId: string;
  };
  room_created: {
    roomId: string;
    creator: string;
    entryFee: string;
    isTokenGated: boolean;
    expiresAt: number | null;
  };
  room_joined: {
    roomId: string;
    member: string;
    feePaid: string;
  };
  room_expired: {
    roomId: string;
    expiredAt: number;
  };
  transfer_sent: {
    from: string;
    to: string;
    amount: string;
    token: string;
  };
  xp_awarded: {
    user: string;
    amount: number;
    reason: string; // 'message' | 'tip' | 'room_create'
    totalXp: number;
  };
  level_up: {
    user: string;
    newLevel: number;
    totalXp: number;
  };
}

/**
 * Topic array layout per event (for getEvents filter construction).
 * Index 0 is always the event name symbol.
 */
export const EVENT_TOPIC_LAYOUT: Record<ContractEventName, string[]> = {
  message_sent: ['message_sent', 'roomId', 'sender'],
  message_deleted: ['message_deleted', 'roomId'],
  tip_sent: ['tip_sent', 'from', 'to'],
  room_created: ['room_created', 'creator'],
  room_joined: ['room_joined', 'roomId', 'member'],
  room_expired: ['room_expired', 'roomId'],
  transfer_sent: ['transfer_sent', 'from', 'to'],
  xp_awarded: ['xp_awarded', 'user'],
  level_up: ['level_up', 'user'],
};
