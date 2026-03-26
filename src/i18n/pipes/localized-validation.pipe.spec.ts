import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { ChallengeRequestDto } from '../../auth/dto/challenge-request.dto';
import { RefreshRequestDto } from '../../auth/dto/refresh-request.dto';
import { LocaleContextService } from '../services/locale-context.service';
import { TranslationService } from '../services/translation.service';
import { createMockI18nService } from '../testing/mock-i18n.service';
import { LocalizedValidationPipe } from './localized-validation.pipe';

describe('LocalizedValidationPipe', () => {
  let moduleRef: TestingModule;
  let localeContext: LocaleContextService;
  let pipe: LocalizedValidationPipe;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        LocaleContextService,
        TranslationService,
        LocalizedValidationPipe,
        {
          provide: I18nService,
          useValue: createMockI18nService(),
        },
      ],
    }).compile();

    localeContext = moduleRef.get(LocaleContextService);
    pipe = moduleRef.get(LocalizedValidationPipe);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('translates validation errors using the current locale', async () => {
    localeContext.setLocale('fr');

    const error = (await pipe
      .transform(
        { walletAddress: 'invalid-address' },
        { type: 'body', metatype: ChallengeRequestDto, data: '' },
      )
      .catch((exception) => exception)) as BadRequestException;

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error.getResponse() as any).message).toEqual(
      expect.arrayContaining([
        'walletAddress doit contenir exactement 56 caracteres',
        "Format d'adresse Stellar invalide",
      ]),
    );
  });

  it('localizes whitelist validation errors', async () => {
    localeContext.setLocale('pt');

    const error = (await pipe
      .transform(
        { refreshToken: 'valid-token', unexpected: true },
        { type: 'body', metatype: RefreshRequestDto, data: '' },
      )
      .catch((exception) => exception)) as BadRequestException;

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error.getResponse() as any).message).toContain(
      'A propriedade unexpected nao deve existir',
    );
  });
});
