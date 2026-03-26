import { i18nValidationMessage } from 'nestjs-i18n';

export const validationMessages = {
  string: () => i18nValidationMessage('validation.string'),
  notEmpty: () => i18nValidationMessage('validation.notEmpty'),
  email: () => i18nValidationMessage('validation.email'),
  url: () => i18nValidationMessage('validation.url'),
  minLength: (min: number) => i18nValidationMessage('validation.minLength', { min }),
  maxLength: (max: number) => i18nValidationMessage('validation.maxLength', { max }),
  exactLength: (length: number) =>
    i18nValidationMessage('validation.exactLength', { length }),
  usernamePattern: () => i18nValidationMessage('validation.usernamePattern'),
  stellarAddressFormat: () => i18nValidationMessage('validation.stellarAddressFormat'),
  ethereumAddress: () => i18nValidationMessage('validation.ethereumAddress'),
  integer: () => i18nValidationMessage('validation.integer'),
  min: (min: number) => i18nValidationMessage('validation.min', { min }),
  max: (max: number) => i18nValidationMessage('validation.max', { max }),
  enum: (allowed: readonly string[]) =>
    i18nValidationMessage('validation.enum', { allowed: allowed.join(', ') }),
  booleanString: () => i18nValidationMessage('validation.booleanString'),
  uuid: () => i18nValidationMessage('validation.uuid'),
};
