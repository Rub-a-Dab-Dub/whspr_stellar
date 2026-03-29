import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * Wraps a signed inner Stellar transaction in a fee-bump envelope so the platform sponsor pays network fees.
 */
@Injectable()
export class StellarFeeBumpService {
  private readonly logger = new Logger(StellarFeeBumpService.name);

  constructor(private readonly configService: ConfigService) {}

  private networkPassphrase(): string {
    return this.configService.get<string>(
      'SOROBAN_NETWORK_PASSPHRASE',
      'Test SDF Network ; September 2015',
    );
  }

  /** @returns true when sponsor secret is configured. */
  isSponsorConfigured(): boolean {
    const secret = this.configService.get<string>('SPONSORSHIP_SPONSOR_SECRET', '');
    return Boolean(secret?.trim());
  }

  /**
   * Builds a signed fee-bump transaction XDR (base64) wrapping the inner envelope.
   * Inner transaction must already include all required signatures (e.g. user).
   *
   * @param innerEnvelopeXdr base64 transaction envelope XDR
   * @param maxFeeStroops max fee the sponsor authorizes for the inner tx (string stroops)
   */
  buildFeeBumpEnvelopeXdr(innerEnvelopeXdr: string, maxFeeStroops: string): string {
    const secret = this.configService.get<string>('SPONSORSHIP_SPONSOR_SECRET', '');
    if (!secret?.trim()) {
      throw new Error('SPONSORSHIP_SPONSOR_SECRET is not configured');
    }

    const passphrase = this.networkPassphrase();
    const innerTx = new StellarSdk.Transaction(innerEnvelopeXdr, passphrase);
    const sponsor = StellarSdk.Keypair.fromSecret(secret.trim());

    const feeBump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      sponsor,
      maxFeeStroops,
      innerTx,
      passphrase,
    );
    feeBump.sign(sponsor);

    return feeBump.toEnvelope().toXDR('base64');
  }
}
