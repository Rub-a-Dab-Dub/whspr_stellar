/**
 * Predefined reaction types/emojis
 * These are the default emoji reactions available in the system
 */
export const REACTION_TYPES = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  HEART: '❤️',
  FIRE: '🔥',
  LAUGH: '😂',
  SURPRISED: '😮',
  SAD: '😢',
  ANGRY: '😠',
  THINKING: '🤔',
  CLAP: '👏',
  ROCKET: '🚀',
  STAR: '⭐',
  WAVE: '👋',
  SUNGLASSES: '😎',
  PARTY: '🎉',
} as const;

export type ReactionType = (typeof REACTION_TYPES)[keyof typeof REACTION_TYPES];

/**
 * Get all available reaction types as an array
 */
export const getAvailableReactionTypes = (): ReactionType[] => {
  return Object.values(REACTION_TYPES);
};

/**
 * Check if a reaction type is valid/predefined
 */
export const isValidReactionType = (type: string): type is ReactionType => {
  return Object.values(REACTION_TYPES).includes(type as ReactionType);
};
