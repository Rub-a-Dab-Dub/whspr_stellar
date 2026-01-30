import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transfer } from '../entities/transfer.entity';
import { UsersService } from '../../user/user.service';

export interface TransferReceipt {
  transferId: string;
  transactionHash: string;
  sender: {
    id: string;
    email: string;
  };
  recipient: {
    id: string;
    email: string;
  };
  amount: string;
  memo: string;
  note: string;
  status: string;
  blockchainNetwork: string;
  timestamp: Date;
  balanceChanges: {
    senderBefore: string;
    senderAfter: string;
    recipientBefore: string;
    recipientAfter: string;
  };
}

@Injectable()
export class TransferReceiptService {
  private readonly logger = new Logger(TransferReceiptService.name);

  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    private readonly usersService: UsersService,
  ) {}

  async generateReceipt(transferId: string, userId: string): Promise<TransferReceipt> {
    const transfer = await this.transferRepository.findOne({
      where: { id: transferId },
      relations: ['sender', 'recipient'],
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.senderId !== userId && transfer.recipientId !== userId) {
      throw new NotFoundException('Transfer not found');
    }

    return {
      transferId: transfer.id,
      transactionHash: transfer.transactionHash,
      sender: {
        id: transfer.sender.id,
        email: transfer.sender.email,
      },
      recipient: {
        id: transfer.recipient.id,
        email: transfer.recipient.email,
      },
      amount: transfer.amount,
      memo: transfer.memo,
      note: transfer.note,
      status: transfer.status,
      blockchainNetwork: transfer.blockchainNetwork,
      timestamp: transfer.completedAt || transfer.createdAt,
      balanceChanges: {
        senderBefore: transfer.senderBalanceBefore || '0',
        senderAfter: transfer.senderBalanceAfter || '0',
        recipientBefore: transfer.recipientBalanceBefore || '0',
        recipientAfter: transfer.recipientBalanceAfter || '0',
      },
    };
  }

  async generateReceiptPDF(transferId: string, userId: string): Promise<Buffer> {
    const receipt = await this.generateReceipt(transferId, userId);
    
    // TODO: Implement PDF generation using a library like pdfkit or puppeteer
    // For now, return a placeholder
    const receiptText = JSON.stringify(receipt, null, 2);
    return Buffer.from(receiptText);
  }
}
