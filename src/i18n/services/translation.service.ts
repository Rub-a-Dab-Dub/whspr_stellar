import { Injectable } from '@nestjs/common';
import { I18nService, TranslateOptions } from 'nestjs-i18n';
import {
  DEFAULT_LOCALE,
  DEFAULT_LOCALES,
  coerceSupportedLocale,
} from '../locales.constants';
import { LocaleContextService } from './locale-context.service';

@Injectable()
export class TranslationService {
  constructor(
    private readonly i18nService: I18nService<Record<string, unknown>>,
    private readonly localeContext: LocaleContextService,
  ) {}

  getSupportedLocales(): string[] {
    const locales = this.i18nService.getSupportedLanguages();
    return locales.length > 0 ? locales : [...DEFAULT_LOCALES];
  }

  normalizeSupportedLocale(candidate?: string | null): string | null {
    return coerceSupportedLocale(candidate, this.getSupportedLocales());
  }

  resolveLocale(candidate?: string | null): string {
    return (
      this.normalizeSupportedLocale(candidate) ??
      this.normalizeSupportedLocale(this.localeContext.getLocale()) ??
      DEFAULT_LOCALE
    );
  }

  getCurrentLocale(): string {
    return this.resolveLocale(this.localeContext.getLocale());
  }

  translate(
    key: string,
    options: Omit<TranslateOptions, 'lang'> & { lang?: string | null } = {},
  ): string {
    return this.i18nService.translate(key, {
      ...options,
      lang: this.resolveLocale(options.lang),
    }) as string;
  }

  translateForLocale(
    locale: string | null | undefined,
    key: string,
    args?: Record<string, unknown>,
  ): string {
    return this.translate(key, {
      lang: locale,
      args,
    });
  }

  looksLikeTranslationKey(value: string): boolean {
    return value.includes('.') && /^[A-Za-z0-9._-]+$/.test(value);
  }
}
