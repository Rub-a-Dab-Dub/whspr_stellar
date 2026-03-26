import { i18nValidationMessage } from 'nestjs-i18n';

export const validationMessages = {
  string: () => i18nValidationMessage('validation.string'),
  notEmpty: () => i18nValidationMessage('validation.notEmpty'),
  email: () => i18nValidationMessage('validation.email'),
  minLength: (min: number) => i18nValidationMessage('validation.minLength', { min }),
  maxLength: (max: number) => i18nValidationMessage('validation.maxLength', { max }),
  enum: (allowed: string[]) => i18nValidationMessage('validation.enum', { allowed: allowed.join(', ') }),
};
