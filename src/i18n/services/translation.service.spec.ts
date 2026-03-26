import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { LocaleContextService } from './locale-context.service';
import { TranslationService } from './translation.service';
import { createMockI18nService } from '../testing/mock-i18n.service';

describe('TranslationService', () => {
  let moduleRef: TestingModule;
  let localeContext: LocaleContextService;
  let translationService: TranslationService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        LocaleContextService,
        TranslationService,
        {
          provide: I18nService,
          useValue: createMockI18nService(),
        },
      ],
    }).compile();

    localeContext = moduleRef.get(LocaleContextService);
    translationService = moduleRef.get(TranslationService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('loads the supported locales from translation files', () => {
    expect(translationService.getSupportedLocales()).toEqual(
      expect.arrayContaining(['en', 'fr', 'pt', 'sw']),
    );
  });

  it('normalizes regional locales to a supported base locale', () => {
    expect(translationService.normalizeSupportedLocale('fr-CA')).toBe('fr');
    expect(translationService.normalizeSupportedLocale('pt_BR')).toBe('pt');
  });

  it('uses the current request locale from async context when no locale is passed', () => {
    const translated = localeContext.runWithLocale('pt', () =>
      translationService.translate('errors.auth.invalidToken'),
    );

    expect(translated).toBe('Token invalido');
  });

  it('falls back to english when a translation key is missing in the requested locale', () => {
    expect(translationService.translate('fallback.example', { lang: 'sw' })).toBe(
      'Fallback example',
    );
  });
});
