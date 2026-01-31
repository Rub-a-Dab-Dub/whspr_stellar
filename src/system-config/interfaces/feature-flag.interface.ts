export interface FeatureFlagVariant {
  name: string;
  weight: number;
  payload?: Record<string, any>;
}

export interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercent?: number;
  targetUsers?: string[];
  excludedUsers?: string[];
  variants?: FeatureFlagVariant[];
  killSwitch?: boolean;
}
