import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../../user/user.service';
import { TransferBalanceService } from './transfer-balance.service';

@Injectable()
export class TransferValidationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly balanceService: TransferBalanceService,
  ) {}

  async validateRecipient(recipientId: string, senderId: string): Promise<void> {
    if (recipientId === senderId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    const recipient = await this.usersService.findById(recipientId);
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    if (recipient.isBanned) {
      throw new BadRequestException('Recipient account is banned');
    }

    if (recipient.suspendedUntil && new Date(recipient.suspendedUntil) > new Date()) {
      throw new BadRequestException('Recipient account is suspended');
    }
  }

  async validateBalance(
    senderId: string,
    amount: number,
    network: string,
  ): Promise<void> {
    const balance = await this.balanceService.getBalance(senderId, network);
    
    if (balance < amount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${balance}, Required: ${amount}`,
      );
    }
  }

  async validateBulkTransfer(
    senderId: string,
    recipients: Array<{ recipientId: string; amount: number }>,
    network: string,
  ): Promise<void> {
    const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0);
    
    await this.validateBalance(senderId, totalAmount, network);

    const uniqueRecipients = new Set(recipients.map(r => r.recipientId));
    if (uniqueRecipients.size !== recipients.length) {
      throw new BadRequestException('Duplicate recipients found in bulk transfer');
    }

    if (uniqueRecipients.has(senderId)) {
      throw new BadRequestException('Cannot include yourself as a recipient');
    }

    for (const recipient of recipients) {
      await this.validateRecipient(recipient.recipientId, senderId);
    }
  }

  validateAmount(amount: number): void {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    if (amount > 1000000000) {
      throw new BadRequestException('Amount exceeds maximum limit');
    }

    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    if (decimalPlaces > 8) {
      throw new BadRequestException('Amount cannot have more than 8 decimal places');
    }
  }
}
