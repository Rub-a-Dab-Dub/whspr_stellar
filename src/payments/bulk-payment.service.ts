import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as csv from 'csv-parser';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BulkPaymentsRepository } from './bulk-payments.repository';
import { BulkPaymentStorageService } from './bulk-payment-storage.service';
import { BulkPayment } from './entities/bulk-payment.entity';
import { BulkPaymentRow } from './entities/bulk-payment-row.entity';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { BulkPaymentStatus } from './enums/bulk-payment-status.enum';
import { UserService } from '../../users/users.service'; // assume exists
import { WalletsService } from '../../wallets/wallets.service'; // assume for balance
import { MailService } from '../../mail/mail.service';

@Injectable()
export class BulkPaymentService {
  private readonly logger = new Logger(BulkPaymentService.name);
  private readonly maxRows = 500;
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB

  constructor(
    private readonly repo: BulkPaymentsRepository,
    private readonly storage: BulkPaymentStorageService,
    private readonly userService: UserService,
    private readonly walletService: WalletsService,
    private readonly mailService: MailService,
    @InjectQueue('bulk-payments') private bulkPaymentQueue: Queue,
    private configService: ConfigService,
  ) {}

  async upload(
    userId: string,
    dto: BulkUploadDto,
    csvFile: Express.Multer.File,
  ): Promise<BulkPayment> {
    // 1. Tier gate (handled by guard, but double check)
    const user = await this.userService.findById(userId);
    if (!['gold', 'black'].includes(user.tier)) {
      throw new ForbiddenException('Gold or Black tier required');
    }

    // 2. File validation
    if (csvFile.size > this.maxFileSize) {
      throw new BadRequestException('CSV too large (max 5MB)');
    }
    if (!csvFile.originalname.endsWith('.csv')) {
      throw new BadRequestException('File must be CSV');
    }

    // 3. Parse & validate CSV
    const rows: Partial<BulkPaymentRow>[] = [];
    const totalAmount = BigInt(0);
    const stream = csvFile.buffer.toString().split('\n').slice(1); // skip header

    let rowNum = 0;
    for await (const chunk of stream) {
      rowNum++;
      if (rows.length >= this.maxRows) {
        throw new BadRequestException(`Too many rows (max ${this.maxRows})`);
      }

      const line = chunk.trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 2) {
        throw new BadRequestException(`Invalid CSV row ${rowNum}: missing columns`);
      }

      const [username, amountStr, ...noteParts] = parts;
      const amount = parseFloat(amountStr.trim().replace(/"/g, ''));
      if (isNaN(amount) || amount <= 0 || !Number.isFinite(amount)) {
        throw new BadRequestException(`Invalid amount row ${rowNum}: ${amountStr}`);
      }

      // Check username exists & active
      const recipient = await this.userService.findByUsername(username.trim());
      if (!recipient || !recipient.isActive) {
        throw new BadRequestException(`User not found/active: ${username} (row ${rowNum})`);
      }

      // Check total balance (sender)
      const balance = await this.walletService.getUsdcBalance(userId);
      if (Number(balance) < Number(totalAmount + BigInt(Math.round(amount * 1e7)))) { // 7 decimals USDC
        throw new BadRequestException(`Insufficient balance for total amount`);
      }

      totalAmount += BigInt(Math.round(amount * 1e7));

      rows.push({
        toUsername: username.trim(),
        amountUsdc: amount.toFixed(7),
        note: noteParts.join(',').trim() || undefined,
      });
    }

    if (rows.length === 0) {
      throw new BadRequestException('No valid rows found');
    }

    // 4. Upload raw CSV to R2
    const csvKey = await this.storage.uploadCsv(csvFile.buffer, csvFile.originalname);

    // 5. Save to DB
    const bulkPayment = await this.repo.createBulkPayment({
      initiatedById: userId,
      label: dto.label,
      csvKey,
      totalRows: rows.length,
      totalAmountUsdc: totalAmount.toString(),
    }, rows);

    // 6. Enqueue processing
    await this.bulkPaymentQueue.add('process-bulk-payment', { bulkPaymentId: bulkPayment.id });

    // Mark PIN verified (assume verified by guard)
    bulkPayment.pinVerifiedAt = new Date();
    await this.repo.bulkPaymentRepo.update(bulkPayment.id, { pinVerifiedAt: bulkPayment.pinVerifiedAt });

    return bulkPayment;
  }
}

