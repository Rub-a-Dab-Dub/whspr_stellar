import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface SorobanTransferPayload {
  senderAddress: string;
  recipientAddresses: string[];
  asset: string;
  amountPerRecipient: string;
  totalAmount: string;
}

@Injectable()
export class SorobanTransfersService {
  async estimateFee(asset: string, amount: string, recipientCount: number): Promise<string> {
    const normalizedAsset = asset.toUpperCase();
    const assetMultiplier = normalizedAsset === 'XLM' ? 10_000 : 15_000;
    const scaledAmount = Math.max(1, Math.round(Number(amount) * 10_000));
    const stroops = assetMultiplier + scaledAmount + recipientCount * 5_000;

    return (stroops / 10_000_000).toFixed(7);
  }

  async submitTransfer(payload: SorobanTransferPayload): Promise<string> {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 16);
    return `soroban_${payload.asset.toLowerCase()}_${suffix}`;
  }
}
