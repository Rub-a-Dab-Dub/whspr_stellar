import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';\nimport { ConfigService } from '@nestjs/config';\nimport { Cron } from '@nestjs/schedule';\nimport { Paystack } from 'paystack';\nimport { MembershipTierService } from '../membership-tier/membership-tier.service';\nimport { PaymentsRepository } from './payments.repository';\nimport { CreateCheckoutDto } from './dto/create-checkout.dto';\nimport { PaginatedPaymentHistoryDto } from './dto/paginated-payment-history.dto';\nimport { SubscriptionStatus, Subscription } from './entities/subscription.entity';\nimport { PaymentStatus, PaymentRecord } from './entities/payment-record.entity';\nimport { UserTier } from '../users/entities/user.entity';\nimport { addMonths } from 'date-fns';\nimport * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private paystack: Paystack;

  constructor(
    private readonly repo: PaymentsRepository,
    private readonly tierService: MembershipTierService,
    private configService: ConfigService,
  ) {
    this.paystack = new Paystack(this.configService.get('PAYSTACK_SECRET_KEY'), { format: 'json' });
  }

  async createCheckoutSession(dto: CreateCheckoutDto, userId: string) {
    const { tier, email, amount } = dto;

    // Check current tier
    const currentSub = await this.repo.findUserActiveSubscription(userId);
    if (currentSub && currentSub.tier === tier) {
      throw new BadRequestException('User already has this tier');
    }

    // Create pending payment record
    const reference = `chk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const payment = await this.repo.createPaymentRecord({
      userId,
      amount: amount.toString(),
      currency: 'NGN',
      provider: 'paystack',
      providerPaymentId: reference,
      status: PaymentStatus.PENDING,
    });

    // Init Paystack checkout
    const response = await this.paystack.transaction.initialize({
      amount,
      email,
      reference,
      callback_url: `${this.configService.get('FRONTEND_URL')}/payments/success?reference=${reference}`,
      metadata: { userId, tier },
    });

    if (!response.data.authorization_url) {
      throw new BadRequestException('Failed to create checkout session');
    }

    return {
      checkoutUrl: response.data.authorization_url,
      reference: response.data.reference,
      paymentId: payment.id,
    };
  }

  async handleWebhook(body: any, signature: string) {
const hash = crypto.createHmac('sha512', this.configService.get('PAYSTACK_SECRET_KEY')).update(JSON.stringify(body)).digest('hex');
    if (hash !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = body.event;
    const ref = body.data.reference;

    const payment = await this.repo.findPaymentByProviderId(ref);
    if (!payment) {
      this.logger.warn(`Payment not found for ref: ${ref}`);
      return { success: true };
    }

    switch (event) {
      case 'charge.success':
        await this.handlePaymentSuccess(body.data, payment);
        break;
      case 'subscription.disable':
        await this.handleSubscriptionCancel(body.data, payment);
        break;
      case 'invoice.payment_failed':
        await this.repo.updatePaymentRecord(payment.id, { status: PaymentStatus.FAILED });
        break;
      default:
        this.logger.log(`Unhandled event: ${event}`);
    }

    return { success: true };
  }

  private async handlePaymentSuccess(data: any, payment: PaymentRecord) {
    payment.status = PaymentStatus.SUCCESS;
    payment.providerPaymentId = data.reference;
    payment.paidAt = new Date(data.paid_at * 1000); // Paystack unix ms
    await this.repo.updatePaymentRecord(payment.id, payment);

    const userId = payment.userId;
    const tier: UserTier = data.metadata.tier;
    const periodMonths = tier === UserTier.GOLD ? 1 : tier === UserTier.BLACK ? 3 : 1;

    // Create or update subscription
    let sub = await this.repo.findUserActiveSubscription(userId);
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) {
      sub = await this.repo.createSubscription({
        userId,
        tier,
        status: SubscriptionStatus.ACTIVE,
        providerSubscriptionId: data.reference, // Use payment ref as sub id for one-time
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), periodMonths),
      });
    } else {
      // Renew
      sub.currentPeriodStart = new Date();
      sub.currentPeriodEnd = addMonths(sub.currentPeriodEnd!, periodMonths);
      sub.status = SubscriptionStatus.ACTIVE;
      await this.repo.updateSubscription(sub.id, sub);
    }

    // Upgrade tier
    await this.tierService.upgradeTier(userId, tier);

    this.logger.log(`Tier upgraded for user ${userId} to ${tier} via payment ${payment.id}`);
  }

  private async handleSubscriptionCancel(data: any, payment: PaymentRecord) {
    const sub = await this.repo.findUserSubscription(payment.userId);
    if (sub) {
      sub.status = SubscriptionStatus.CANCELLED;
      sub.cancelledAt = new Date();
      await this.repo.updateSubscription(sub.id, sub);
    }
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    return this.repo.findUserSubscription(userId);
  }

  async getPaymentHistory(userId: string, dto: PaginatedPaymentHistoryDto) {
    return this.repo.getUserPaymentHistory(userId, dto);
  }

  async cancelSubscription(userId: string) {
    const sub = await this.repo.findUserActiveSubscription(userId);
    if (!sub) {
      throw new NotFoundException('No active subscription found');
    }

    sub.status = SubscriptionStatus.CANCELLED;
    sub.cancelledAt = new Date();
    await this.repo.updateSubscription(sub.id, sub);

    // Note: tier downgrade at period end via cron
    this.logger.log(`Subscription cancelled for user ${userId}, effective period end`);
  }

  @Cron('0 */6 * * * *') // every 6 hours\n  async handleExpiredSubscriptions() {\n    const expired = await this.repo.findExpiredSubscriptions();\n    let downgraded = 0;\n    for (const sub of expired) {\n      sub.status = SubscriptionStatus.EXPIRED;\n      await this.repo.updateSubscription(sub.id, { status: SubscriptionStatus.EXPIRED });\n      await this.tierService.upgradeTier(sub.userId, UserTier.SILVER);\n      downgraded++;\n    }\n    this.logger.log(`Downgraded ${downgraded} expired subscriptions`);\n    return { processedCount: downgraded };\n  }\n\n  async resumeSubscription(userId: string) {\n    const sub = await this.repo.findUserSubscription(userId);\n    if (!sub || sub.status !== SubscriptionStatus.CANCELLED) {\n      throw new BadRequestException('No cancellable subscription found');\n    }\n\n    sub.status = SubscriptionStatus.ACTIVE;\n    sub.cancelledAt = null;\n    await this.repo.updateSubscription(sub.id, sub);\n\n    this.logger.log(`Subscription resumed for user ${userId}`);\n  }\n}\n
