import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FeeSponsorshipService } from '../fee-sponsorship/fee-sponsorship.service';

export interface SorobanTransferPayload {
  senderAddress: string;
  recipientAddresses: string[];
  asset: string;
  amountPerRecipient: string;
  totalAmount: string;
}

export interface SorobanTransferSponsorContext {
  userId: string;
}

@Injectable()
export class SorobanTransfersService {
  constructor(@Optional() private readonly feeSponsorship?: FeeSponsorshipService) {}

  async estimateFee(asset: string, amount: string, recipientCount: number): Promise<string> {
    const normalizedAsset = asset.toUpperCase();
    const assetMultiplier = normalizedAsset === 'XLM' ? 10_000 : 15_000;
    const scaledAmount = Math.max(1, Math.round(Number(amount) * 10_000));
    const stroops = assetMultiplier + scaledAmount + recipientCount * 5_000;

    return (stroops / 10_000_000).toFixed(7);
  }

  /**
   * Submits (or simulates) a transfer. When `sponsor` is set and the user is eligible with quota,
   * records fee sponsorship for the returned tx hash using the estimated network fee in XLM.
   * When a real inner transaction XDR exists, use {@link FeeSponsorshipService.buildFeeBumpEnvelope} to wrap it.
   */
  async submitTransfer(
    payload: SorobanTransferPayload,
    sponsor?: SorobanTransferSponsorContext,
  ): Promise<string> {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 16);
    const txHash = `soroban_${payload.asset.toLowerCase()}_${suffix}`;

    if (sponsor?.userId && this.feeSponsorship) {
      const feeEstimate = await this.estimateFee(
        payload.asset,
        payload.totalAmount,
        payload.recipientAddresses.length,
      );
      await this.feeSponsorship.tryConsumeSponsorshipSlot({
        userId: sponsor.userId,
        txHash,
        feeAmountXlm: feeEstimate,
        tokenId: payload.asset,
      });
    }

    return txHash;
  }
}
