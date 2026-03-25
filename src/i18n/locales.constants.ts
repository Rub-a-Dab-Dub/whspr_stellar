export const DEFAULT_LOCALE = 'en';
export const DEFAULT_LOCALES = ['en', 'fr', 'pt', 'sw'] as const;

type HeaderValue = string | string[] | undefined;

function normalizeLocaleTag(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-');
}

export function coerceSupportedLocale(
  candidate: string | null | undefined,
  supportedLocales: readonly string[],
): string | null {
  if (!candidate) {
    return null;
  }

  const normalized = normalizeLocaleTag(candidate);
  const normalizedSupportedLocales = supportedLocales.map((locale) =>
    normalizeLocaleTag(locale),
  );

  if (normalizedSupportedLocales.includes(normalized)) {
    return normalized;
  }

  const baseLocale = normalized.split('-')[0];
  return normalizedSupportedLocales.includes(baseLocale) ? baseLocale : null;
}

export function parseAcceptLanguageHeader(
  header: HeaderValue,
  supportedLocales: readonly string[],
): string | null {
  const headerValue = Array.isArray(header) ? header.join(',') : header;

  if (!headerValue) {
    return null;
  }

  const candidates = headerValue
    .split(',')
    .map((entry) => {
      const [rawLocale, ...params] = entry.trim().split(';');
      const qualityParam = params.find((param) => param.trim().startsWith('q='));
      const quality = qualityParam ? Number.parseFloat(qualityParam.split('=')[1]) : 1;

      return {
        locale: rawLocale.trim(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((candidate) => candidate.locale.length > 0)
    .sort((left, right) => right.quality - left.quality);

  for (const candidate of candidates) {
    const locale = coerceSupportedLocale(candidate.locale, supportedLocales);
    if (locale) {
      return locale;
    }
  }

  return null;
}
