import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { RequestWithLocale } from '../interfaces/request-with-locale.interface';
import { LocaleContextService } from '../services/locale-context.service';
import { TranslationService } from '../services/translation.service';
import { LocaleGuard } from './locale.guard';

const normalizeSupportedLocale = (locale?: string | null): string | null => {
  if (!locale) {
    return null;
  }

  const normalized = locale.toLowerCase().replace(/_/g, '-');
  if (['en', 'fr', 'pt', 'sw'].includes(normalized)) {
    return normalized;
  }

  const baseLocale = normalized.split('-')[0];
  return ['en', 'fr', 'pt', 'sw'].includes(baseLocale) ? baseLocale : null;
};

describe('LocaleGuard', () => {
  let guard: LocaleGuard;
  let jwtService: jest.Mocked<JwtService>;
  let userRepository: { findOne: jest.Mock };
  let localeContext: LocaleContextService;

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        LocaleGuard,
        LocaleContextService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: TranslationService,
          useValue: {
            getSupportedLocales: jest.fn(() => ['en', 'fr', 'pt', 'sw']),
            normalizeSupportedLocale: jest.fn(normalizeSupportedLocale),
            resolveLocale: jest.fn(() => 'en'),
          },
        },
      ],
    }).compile();

    guard = moduleRef.get(LocaleGuard);
    jwtService = moduleRef.get(JwtService);
    localeContext = moduleRef.get(LocaleContextService);
  });

  it('uses the Accept-Language header for locale detection', async () => {
    const request = {
      headers: { 'accept-language': 'pt-BR,fr;q=0.8' },
    } as unknown as RequestWithLocale;

    await guard.canActivate(createHttpContext(request));

    expect(request.locale).toBe('pt');
    expect(request.i18nLang).toBe('pt');
    expect(localeContext.getLocale()).toBe('pt');
  });

  it('prefers the stored user locale over the request header', async () => {
    const request = {
      headers: {
        authorization: 'Bearer signed-token',
        'accept-language': 'sw',
      },
    } as unknown as RequestWithLocale;

    jwtService.verify.mockReturnValue({ sub: 'user-1' } as any);
    userRepository.findOne.mockResolvedValue({ preferredLocale: 'fr' });

    await guard.canActivate(createHttpContext(request));

    expect(request.locale).toBe('fr');
  });

  it('falls back to the header locale when the token is invalid', async () => {
    const request = {
      headers: {
        authorization: 'Bearer bad-token',
        'accept-language': 'fr',
      },
    } as unknown as RequestWithLocale;

    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await guard.canActivate(createHttpContext(request));

    expect(request.locale).toBe('fr');
  });

  it('falls back to english when no supported locale can be resolved', async () => {
    const request = {
      headers: {
        'accept-language': 'de-DE,de;q=0.8',
      },
    } as unknown as RequestWithLocale;

    await guard.canActivate(createHttpContext(request));

    expect(request.locale).toBe('en');
  });
});

function createHttpContext(request: RequestWithLocale): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}
