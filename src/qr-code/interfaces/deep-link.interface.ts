export type DeepLinkType = 'pay' | 'group_join' | 'profile';

export interface ParsedDeepLink {
  type: DeepLinkType;
  to?: string;
  amount?: string;
  token?: string;
  inviteCode?: string;
  username?: string;
}

export interface DeepLinkError {
  error: string;
  type: 'INVALID_SCHEME' | 'UNKNOWN_PATH' | 'MISSING_PARAM' | 'INVALID_PARAM';
}
