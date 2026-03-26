import { BadRequestException } from '@nestjs/common';
import { AppConfigValueType, type AppConfigValueType as ValueType } from './constants';

export interface AppConfigDefaultDefinition {
  value: unknown;
  valueType: ValueType;
  description: string;
  isPublic: boolean;
  /** Optional strict check after type validation */
  validate?: (value: unknown) => void;
}

/** Minimal v1 registry — extend keys here as the product grows */
export const APP_CONFIG_DEFAULTS: Record<string, AppConfigDefaultDefinition> = {
  'platform.maintenance_mode': {
    value: false,
    valueType: AppConfigValueType.BOOLEAN,
    description: 'When true, clients should surface a maintenance experience',
    isPublic: true,
  },
  'limits.max_attachment_mb': {
    value: 25,
    valueType: AppConfigValueType.NUMBER,
    description: 'Maximum attachment size in megabytes',
    isPublic: true,
    validate: (v) => {
      const n = v as number;
      if (n < 1 || n > 512) {
        throw new BadRequestException('limits.max_attachment_mb must be between 1 and 512');
      }
    },
  },
  'features.enable_referrals': {
    value: true,
    valueType: AppConfigValueType.BOOLEAN,
    description: 'Referral program UI and API enabled',
    isPublic: true,
  },
  'limits.daily_transfer_cap_usd': {
    value: 10_000,
    valueType: AppConfigValueType.NUMBER,
    description: 'Soft cap for aggregate transfer volume alerting (USD)',
    isPublic: false,
    validate: (v) => {
      const n = v as number;
      if (n < 0 || n > 1_000_000_000) {
        throw new BadRequestException('limits.daily_transfer_cap_usd must be between 0 and 1e9');
      }
    },
  },
  'platform.support_contact': {
    value: 'support@example.com',
    valueType: AppConfigValueType.STRING,
    description: 'Public support contact string',
    isPublic: true,
    validate: (v) => {
      const s = String(v);
      if (s.length > 256) {
        throw new BadRequestException('platform.support_contact is too long');
      }
    },
  },
};

export function assertValueMatchesDeclaredType(raw: unknown, valueType: ValueType): void {
  switch (valueType) {
    case AppConfigValueType.STRING:
      if (typeof raw !== 'string') {
        throw new BadRequestException('Value must be a string');
      }
      break;
    case AppConfigValueType.NUMBER:
      if (typeof raw !== 'number' || Number.isNaN(raw)) {
        throw new BadRequestException('Value must be a number');
      }
      break;
    case AppConfigValueType.BOOLEAN:
      if (typeof raw !== 'boolean') {
        throw new BadRequestException('Value must be a boolean');
      }
      break;
    case AppConfigValueType.JSON:
      if (raw === null || typeof raw !== 'object') {
        throw new BadRequestException('Value must be a JSON object or array');
      }
      break;
    default:
      throw new BadRequestException('Unknown value type');
  }
}

export function validateConfigValue(key: string, raw: unknown): void {
  const def = APP_CONFIG_DEFAULTS[key];
  if (!def) {
    return;
  }
  assertValueMatchesDeclaredType(raw, def.valueType);
  def.validate?.(raw);
}
