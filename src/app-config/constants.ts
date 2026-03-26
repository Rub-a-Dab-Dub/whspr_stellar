export const APP_CONFIG_SNAPSHOT_CACHE_KEY = 'app_config:snapshot';

/** Cache TTL — config propagation across instances within this window */
export const APP_CONFIG_CACHE_TTL_SECONDS = 30;

export const ADMIN_CONFIG_WS_NAMESPACE = '/admin-config';

export const ADMIN_CONFIG_WS_ROOM = 'admin-config';

export const AppConfigValueType = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  JSON: 'JSON',
} as const;

export type AppConfigValueType = (typeof AppConfigValueType)[keyof typeof AppConfigValueType];
