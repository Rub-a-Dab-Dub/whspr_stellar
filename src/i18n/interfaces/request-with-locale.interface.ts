import { Request } from 'express';

export interface RequestWithLocale extends Request {
  locale?: string;
  i18nLang?: string;
  user?: {
    userId?: string;
    preferredLocale?: string | null;
    user?: {
      id?: string;
      preferredLocale?: string | null;
    };
  };
}
