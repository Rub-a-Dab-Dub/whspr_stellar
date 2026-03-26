import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailContentService } from './email-content.service';
import { LocaleContextService } from './locale-context.service';
import { NotificationContentService } from './notification-content.service';
import { TranslationService } from './translation.service';
import { createMockI18nService } from '../testing/mock-i18n.service';

describe('Localized content builders', () => {
  let moduleRef: TestingModule;
  let emails: EmailContentService;
  let notifications: NotificationContentService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        LocaleContextService,
        TranslationService,
        NotificationContentService,
        EmailContentService,
        {
          provide: I18nService,
          useValue: createMockI18nService(),
        },
      ],
    }).compile();

    emails = moduleRef.get(EmailContentService);
    notifications = moduleRef.get(NotificationContentService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('builds notification content in the user preferred locale', () => {
    const content = notifications.buildWalletLinkedNotification({
      preferredLocale: 'sw',
      walletAddress: 'GABC123',
      walletLabel: 'Main Wallet',
    });

    expect(content.locale).toBe('sw');
    expect(content.title).toBe('Wallet imeunganishwa');
    expect(content.body).toContain('Main Wallet');
  });

  it('builds email content in the requested locale', () => {
    const content = emails.buildWelcomeEmail({
      preferredLocale: 'fr',
      displayName: 'Amina',
    });

    expect(content.locale).toBe('fr');
    expect(content.subject).toBe('Bienvenue sur WHSPR Stellar');
    expect(content.body).toContain('Amina');
  });
});
