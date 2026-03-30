import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './common/redis/redis-throttler-storage';
import { RedisModule } from './common/redis/redis.module';
import { RedisService } from './common/redis/redis.service';
import { AdvancedThrottlerGuard } from './common/guards/advanced-throttler.guard';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/typeorm.config';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { ReportsModule } from './reports/reports.module';
import { SessionsModule } from './sessions/sessions.module';
import { WalletsModule } from './wallets/wallets.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TransactionsModule } from './transactions/transactions.module';
import { LoggingModule } from './common/logging/logging.module';
import { ScheduledJobsModule } from './scheduled-jobs/scheduled-jobs.module';
import { NFTsModule } from './nfts/nfts.module';
import { AppI18nModule } from './i18n/app-i18n.module';
import { InChatTransfersModule } from './in-chat-transfers/in-chat-transfers.module';
import { GroupExpensesModule } from './group-expenses/group-expenses.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ObservabilityModule } from './observability/observability.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { AppConfigModule } from './app-config/app-config.module';
import { AdminModule } from './admin/admin.module';
import { MembershipTierModule } from './membership-tier/membership-tier.module';
import { CacheModule } from './cache/cache.module';
import { RedisCacheModule } from './cache/redis-cache.module';
import { StellarEventsModule } from './stellar-events/stellar-events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReactionsModule } from './reactions/reactions.module';
import { StickersModule } from './stickers/stickers.module';
import { PrivacyModule } from './privacy/privacy.module';
import { SpamDetectionModule } from './spam-detection/spam-detection.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { EmailModule } from './email/email.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { PinnedMessagesModule } from './pinned-messages/pinned-messages.module';
import { Sep10Module } from './sep10/sep10.module';
import { RampModule } from './ramp/ramp.module';
import { QrCodeModule } from './qr-code/qr-code.module';
import { BotsModule } from './bots/bots.module';
import { BlockchainTransactionsModule } from './blockchain-transactions/blockchain-transactions.module';
import { MessageForwardingModule } from './message-forwarding/message-forwarding.module';
import { PollsModule } from './polls/polls.module';
import { MentionsModule } from './mentions/mentions.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AppVersionModule } from './app-version/app-version.module';
import { RecurringPaymentsModule } from './recurring-payments/recurring-payments.module';
import { AnchorModule } from './anchor/anchor.module';
import { MessageDraftsModule } from './message-drafts/message-drafts.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { ConversationExportModule } from './conversation-export/conversation-export.module';
import { FeedbackModule } from './feedback/feedback.module';
import { RevenueModule } from './revenue/revenue.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { PaymentSettingsModule } from './payment-settings/payment-settings.module';

import { AddressBookModule } from './address-book/address-book.module';
import { UsernameDiscoveryModule } from './username-discovery/username-discovery.module';
import { DeveloperSandboxModule } from './developer-sandbox/developer-sandbox.module';
import { StoriesModule } from './stories/stories.module';
import { PaymentsModule } from './payments/payments.module';
import { LinkPreviewsModule } from './link-previews/link-previews.module';
import { NotificationDigestModule } from './notification-digest/notification-digest.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { TrustNetworkModule } from './trust-network/trust-network.module';
import { ReputationModule } from './reputation/reputation.module';
import { AmlMonitoringModule } from './aml/aml-monitoring.module';
import { ConnectionsModule } from './connections/connections.module';
import { ActivityFeedModule } from './activity-feed/activity-feed.module';
import { BlockEnforcementModule } from './block-enforcement/block-enforcement.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),
    TypeOrmModule.forRootAsync({ useFactory: typeOrmConfig }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    RedisCacheModule,
    HealthModule,
    UsersModule,
    AuthModule,
    TwoFactorModule,
    StellarEventsModule,
    TypeOrmModule.forRootAsync({
      useFactory: typeOrmConfig,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    CacheModule,
    FraudDetectionModule,
    LoggingModule,
    ScheduleModule.forRoot(),
    AppI18nModule,
    HealthModule,
    UsersModule,
    UserSettingsModule,
    AppConfigModule,
    AuthModule,
    SessionsModule,
    WalletsModule,
    AnalyticsModule,
    TransactionsModule,
    NotificationsModule,
    ReactionsModule,
    StickersModule,
    PrivacyModule,
    BlockEnforcementModule,
    SpamDetectionModule,
    FeatureFlagsModule,
    ApiKeysModule,
    EmailModule,
    LeaderboardModule,
    PinnedMessagesModule,
    Sep10Module,
    RampModule,
    QrCodeModule,
    ScheduledJobsModule,
    InChatTransfersModule,
    GroupExpensesModule,
    WebhooksModule,
    ObservabilityModule,
    AdminModule,
    MembershipTierModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AdvancedThrottlerGuard,
    },
  ],
})
export class AppModule {}
