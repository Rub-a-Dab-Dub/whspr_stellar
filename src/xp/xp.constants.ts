import { XpReason } from './entities/xp-transaction.entity';

/**
 * XP awarded per action.
 * Values are read at runtime so operators can override via env vars.
 */
export const XP_RULES: Record<XpReason, number> = {
  [XpReason.SEND_MESSAGE]: parseInt(process.env.XP_SEND_MESSAGE ?? '10', 10),
  [XpReason.CREATE_ROOM]: parseInt(process.env.XP_CREATE_ROOM ?? '50', 10),
  [XpReason.TIP_SENT]: parseInt(process.env.XP_TIP_SENT ?? '20', 10),
  [XpReason.TIP_RECEIVED]: parseInt(process.env.XP_TIP_RECEIVED ?? '5', 10),
  [XpReason.QUEST_COMPLETE]: 0, // variable — caller always supplies the amount
  [XpReason.ADMIN_GRANT]: 0, // variable — caller supplies the amount
};

/** XP required per level (level N requires N * XP_PER_LEVEL total XP) */
export const XP_PER_LEVEL = parseInt(process.env.XP_PER_LEVEL ?? '1000', 10);

/** Derive level from cumulative XP total */
export function xpToLevel(xpTotal: number): number {
  return Math.floor(xpTotal / XP_PER_LEVEL) + 1;
}
