import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnboardingService } from './onboarding.service';
import { OnboardingStep } from './entities/onboarding-progress.entity';

export interface WalletConnectedEvent {
  userId: string;
  walletAddress: string;
}

export interface ProfileCompletedEvent {
  userId: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface UsernameSetEvent {
  userId: string;
  username: string;
}

export interface ContactAddedEvent {
  userId: string;
  contactId: string;
}

export interface MessageSentEvent {
  userId: string;
  messageId: string;
  conversationId: string;
}

export interface EncryptionKeyRegisteredEvent {
  userId: string;
  keyId: string;
}

export interface TransferCompletedEvent {
  userId: string;
  transferId: string;
  amount: string;
  asset: string;
}

@Injectable()
export class OnboardingEventListener implements OnModuleInit {
  private readonly logger = new Logger(OnboardingEventListener.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly onboardingService: OnboardingService,
  ) {}

  onModuleInit() {
    this.eventEmitter.on('wallet.connected', this.handleWalletConnected.bind(this));
    this.eventEmitter.on('profile.completed', this.handleProfileCompleted.bind(this));
    this.eventEmitter.on('username.set', this.handleUsernameSet.bind(this));
    this.eventEmitter.on('contact.added', this.handleContactAdded.bind(this));
    this.eventEmitter.on('message.sent', this.handleMessageSent.bind(this));
    this.eventEmitter.on('encryption_key.registered', this.handleEncryptionKeyRegistered.bind(this));
    this.eventEmitter.on('transfer.completed', this.handleTransferCompleted.bind(this));
  }

  async handleWalletConnected(event: WalletConnectedEvent) {
    this.logger.log(`Wallet connected for user ${event.userId}`);
    await this.completeStepSafely(event.userId, OnboardingStep.WALLET_CONNECTED);
  }

  async handleProfileCompleted(event: ProfileCompletedEvent) {
    this.logger.log(`Profile completed for user ${event.userId}`);
    await this.completeStepSafely(event.userId, OnboardingStep.PROFILE_COMPLETED);
  }

  async handleUsernameSet(event: UsernameSetEvent) {
    this.logger.log(`Username set for user ${event.userId}: ${event.username}`);
    await this.completeStepSafely(event.userId, OnboardingStep.USERNAME_SET);
  }

  async handleContactAdded(event: ContactAddedEvent) {
    this.logger.log(`First contact added for user ${event.userId}: ${event.contactId}`);
    await this.completeStepSafely(event.userId, OnboardingStep.FIRST_CONTACT_ADDED);
  }

  async handleMessageSent(event: MessageSentEvent) {
    this.logger.log(`First message sent for user ${event.userId}: ${event.messageId}`);
    await this.completeStepSafely(event.userId, OnboardingStep.FIRST_MESSAGE_SENT);
  }

  async handleEncryptionKeyRegistered(event: EncryptionKeyRegisteredEvent) {
    this.logger.log(`Encryption key registered for user ${event.userId}: ${event.keyId}`);
    await this.completeStepSafely(event.userId, OnboardingStep.ENCRYPTION_KEY_REGISTERED);
  }

  async handleTransferCompleted(event: TransferCompletedEvent) {
    this.logger.log(`First transfer completed for user ${event.userId}: ${event.transferId}`);
    await this.completeStepSafely(event.userId, OnboardingStep.FIRST_TRANSFER);
  }

  private async completeStepSafely(userId: string, step: OnboardingStep) {
    try {
      await this.onboardingService.completeStep(userId, step);
    } catch (error) {
      this.logger.error(`Failed to complete step ${step} for user ${userId}:`, error);
    }
  }
}
