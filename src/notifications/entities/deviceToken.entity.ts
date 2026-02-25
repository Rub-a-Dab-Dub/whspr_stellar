export type Platform = "IOS" | "ANDROID";

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: Platform;
  isActive: boolean;
  lastUsedAt: Date;
}
