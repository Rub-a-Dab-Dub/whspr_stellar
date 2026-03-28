import { I18nService, TranslateOptions } from 'nestjs-i18n';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';
import sw from '../locales/sw.json';

const translationsByLocale: Record<string, Record<string, unknown>> = {
  en,
  fr,
  pt,
  sw,
};

export function createMockI18nService(): Pick<
  I18nService<Record<string, unknown>>,
  'getSupportedLanguages' | 'translate'
> {
  return {
    getSupportedLanguages: () => Object.keys(translationsByLocale),
    translate: ((key: string, options?: TranslateOptions) => {
      const requestedLocale = normalizeLocale(options?.lang);
      const args = (options?.args as Record<string, unknown>) ?? {};

      const translation =
        getTranslationValue(requestedLocale, key) ??
        getTranslationValue('en', key) ??
        key;

      return formatTranslation(translation, args);
    }) as I18nService<Record<string, unknown>>['translate'],
  };
}

function normalizeLocale(locale?: string): string {
  if (!locale) {
    return 'en';
  }

  const normalized = locale.toLowerCase().replace(/_/g, '-');
  if (translationsByLocale[normalized]) {
    return normalized;
  }

  return normalized.split('-')[0] || 'en';
}

function getTranslationValue(locale: string, key: string): string | null {
  const translation = key
    .split('.')
    .reduce<unknown>(
      (value, segment) =>
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)[segment]
          : undefined,
      translationsByLocale[locale],
    );

  return typeof translation === 'string' ? translation : null;
}

function formatTranslation(
  translation: string,
  args: Record<string, unknown>,
): string {
  return translation.replace(/\{([^}]+)\}/g, (_, token: string) => {
    const value = args[token];
    return value === undefined || value === null ? `{${token}}` : String(value);
  });
}
