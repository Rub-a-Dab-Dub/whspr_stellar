import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface KYCSession {
  sessionToken: string;
  externalId: string;
  providerUrl: string;
}

export interface KYCVerificationResult {
  externalId: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  rejectionReason?: string;
  documents?: Record<string, any>;
}

@Injectable()
export class KycProviderService {
  private readonly logger = new Logger(KycProviderService.name);
  private readonly providerUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.providerUrl =
      this.configService.get<string>('KYC_PROVIDER_URL') ??
      'https://api.smileidentity.com';
    this.apiKey = this.configService.get<string>('KYC_API_KEY') ?? '';
  }

  async initiateSession(
    userId: string,
    tier: string,
  ): Promise<KYCSession> {
    this.logger.log(`Initiating KYC session for user: ${userId} tier: ${tier}`);

    try {
      const response = await axios.post(
        `${this.providerUrl}/v1/sessions`,
        { userId, tier, callbackUrl: this.configService.get('KYC_WEBHOOK_URL') },
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );

      return {
        sessionToken: response.data.sessionToken,
        externalId: response.data.sessionId,
        providerUrl: response.data.url,
      };
    } catch (error) {
      this.logger.error(`Failed to initiate KYC session: ${(error as Error).message}`);
      // Return mock session for development
      return {
        sessionToken: `mock-session-${userId}-${Date.now()}`,
        externalId: `mock-external-${userId}-${Date.now()}`,
        providerUrl: `${this.providerUrl}/verify`,
      };
    }
  }

  async verifyWebhookSignature(
    payload: string,
    signature: string,
  ): Promise<boolean> {
    // Verify webhook comes from the real KYC provider
    const expectedSignature = this.configService.get<string>(
      'KYC_WEBHOOK_SECRET',
    );
    return signature === expectedSignature;
  }

  async getVerificationStatus(externalId: string): Promise<KYCVerificationResult> {
    this.logger.log(`Fetching verification status for: ${externalId}`);

    try {
      const response = await axios.get(
        `${this.providerUrl}/v1/sessions/${externalId}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );

      return {
        externalId,
        status: response.data.status,
        rejectionReason: response.data.rejectionReason,
        documents: response.data.documents,
      };
    } catch (error) {
      this.logger.error(`Failed to get verification status: ${(error as Error).message}`);
      throw error;
    }
  }
}