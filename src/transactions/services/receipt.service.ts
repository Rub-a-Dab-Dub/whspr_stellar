import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { Repository } from 'typeorm';
import { Wallet } from '../../wallets/entities/wallet.entity';
import {
  ExportJobResponseDto,
  ExportStatusResponseDto,
  ExportTransactionsDto,
  ReceiptUrlResponseDto,
} from '../dto/receipt.dto';
import { ReceiptPdfGenerator } from './receipt-pdf.generator';

type ReceiptJobData = { userId: string; transactionId: string; walletAddress?: string };
type ExportJobData = { userId: string; walletAddress?: string; filters: ExportTransactionsDto };
type QueueJobData = ReceiptJobData | ExportJobData;

interface TransactionRow {
  id: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  tokenId: string;
  amount: string;
  fee: string;
  status: string;
  type: string;
  conversationId: string | null;
  messageId: string | null;
  network: string;
  ledger: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
}

const QUEUE_NAME = 'transaction-receipts';
const RECEIPT_JOB_PREFIX = 'receipt';
const EXPORT_JOB_PREFIX = 'tx-export';
const DOWNLOAD_TTL_SECONDS = 60 * 60;
const MAX_EXPORT_ROWS = 10_000;

@Injectable()
export class ReceiptService implements OnModuleDestroy {
  private readonly logger = new Logger(ReceiptService.name);
  private readonly queue: Queue<QueueJobData>;
  private readonly queueEvents: QueueEvents;
  private readonly worker: Worker<QueueJobData>;
  private readonly s3Client: S3Client;
  private readonly storageBucket: string;
  private readonly downloadTtlSeconds = DOWNLOAD_TTL_SECONDS;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    private readonly pdfGenerator: ReceiptPdfGenerator,
  ) {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
      maxRetriesPerRequest: null as number | null,
    };

    this.queue = new Queue<QueueJobData>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
    this.queueEvents = new QueueEvents(QUEUE_NAME, { connection });
    this.worker = new Worker<QueueJobData>(QUEUE_NAME, async (job) => this.processJob(job), {
      connection,
    });

    const region = this.configService.get<string>('STORAGE_REGION', 'auto');
    const endpoint = this.configService.get<string>('STORAGE_ENDPOINT');
    const accessKeyId =
      this.configService.get<string>('STORAGE_ACCESS_KEY_ID') ||
      this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey =
      this.configService.get<string>('STORAGE_SECRET_ACCESS_KEY') ||
      this.configService.get<string>('S3_SECRET_ACCESS_KEY');

    this.s3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle: this.configService.get<string>('STORAGE_PROVIDER') === 'r2',
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
    this.storageBucket =
      this.configService.get<string>('STORAGE_BUCKET') ||
      this.configService.get<string>('S3_BUCKET') ||
      '';
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.queueEvents.close();
    await this.queue.close();
  }

  async generateReceipt(
    userId: string,
    transactionId: string,
    walletAddress?: string,
  ): Promise<ReceiptUrlResponseDto> {
    await this.assertTransactionOwnership(userId, transactionId, walletAddress);
    const jobId = this.receiptJobId(userId, transactionId);
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'completed') {
        return this.buildReceiptUrlResponse(transactionId, existing.returnvalue?.fileKey);
      }
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        const result = (await existing.waitUntilFinished(this.queueEvents, 30000)) as {
          fileKey: string;
        };
        return this.buildReceiptUrlResponse(transactionId, result.fileKey);
      }
    }

    const queued = await this.queue.add(
      'generate-receipt',
      { userId, transactionId, walletAddress },
      { jobId },
    );
    const result = (await queued.waitUntilFinished(this.queueEvents, 30000)) as { fileKey: string };
    return this.buildReceiptUrlResponse(transactionId, result.fileKey);
  }

  async getReceiptUrl(
    userId: string,
    transactionId: string,
    walletAddress?: string,
  ): Promise<ReceiptUrlResponseDto> {
    await this.assertTransactionOwnership(userId, transactionId, walletAddress);
    const fileKey = this.receiptFileKey(userId, transactionId);
    const exists = await this.objectExists(fileKey);
    if (!exists) {
      return this.generateReceipt(userId, transactionId, walletAddress);
    }

    const { url, expiresAt } = await this.createDownloadUrl(fileKey);
    return {
      transactionId,
      url,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async exportTransactionHistory(
    userId: string,
    filters: ExportTransactionsDto,
    walletAddress?: string,
  ): Promise<ExportJobResponseDto> {
    this.validateExportRange(filters);

    const queued = await this.queue.add(
      'export-transactions',
      { userId, filters, walletAddress },
      {
        jobId: `${EXPORT_JOB_PREFIX}:${userId}:${Date.now()}`,
      },
    );

    return {
      jobId: String(queued.id),
      status: 'queued',
    };
  }

  async getExportStatus(userId: string, jobId: string): Promise<ExportStatusResponseDto> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    const jobUserId = (job.data as ExportJobData).userId;
    if (jobUserId !== userId) {
      throw new ForbiddenException('This export job does not belong to you');
    }

    const state = await job.getState();
    const status = this.mapJobStatus(state);
    const response: ExportStatusResponseDto = { jobId, status };

    if (state === 'failed') {
      response.error = job.failedReason ?? 'Export failed';
    }

    if (state === 'completed') {
      const fileKey = job.returnvalue?.fileKey as string | undefined;
      if (fileKey) {
        const { url, expiresAt } = await this.createDownloadUrl(fileKey);
        response.downloadUrl = url;
        response.expiresAt = expiresAt.toISOString();
      }
    }

    return response;
  }

  async getExportDownloadUrl(userId: string, jobId: string): Promise<ReceiptUrlResponseDto> {
    const status = await this.getExportStatus(userId, jobId);
    if (status.status !== 'completed' || !status.downloadUrl || !status.expiresAt) {
      throw new BadRequestException('Export is not ready for download');
    }

    return {
      transactionId: jobId,
      url: status.downloadUrl,
      expiresAt: status.expiresAt,
    };
  }

  private async processJob(job: { name: string; data: QueueJobData }): Promise<{ fileKey: string }> {
    if (job.name === 'generate-receipt') {
      return this.handleGenerateReceipt(job.data as ReceiptJobData);
    }
    if (job.name === 'export-transactions') {
      return this.handleExportTransactions(job.data as ExportJobData);
    }
    throw new BadRequestException(`Unsupported queue job: ${job.name}`);
  }

  private async handleGenerateReceipt(jobData: ReceiptJobData): Promise<{ fileKey: string }> {
    const tx = await this.getOwnedTransaction(jobData.userId, jobData.transactionId, jobData.walletAddress);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    const explorerUrl = this.buildExplorerUrl(tx.network, tx.txHash);
    const pdf = await this.pdfGenerator.generate({
      transactionId: tx.id,
      txHash: tx.txHash,
      sender: tx.fromAddress,
      recipient: tx.toAddress,
      amount: tx.amount,
      token: tx.tokenId,
      fee: tx.fee,
      timestamp: (tx.confirmedAt ?? tx.createdAt).toISOString(),
      status: tx.status,
      conversationId: tx.conversationId,
      messageId: tx.messageId,
      explorerUrl,
    });

    const fileKey = this.receiptFileKey(jobData.userId, tx.id);
    await this.uploadFile(fileKey, pdf, 'application/pdf');
    return { fileKey };
  }

  private async handleExportTransactions(jobData: ExportJobData): Promise<{ fileKey: string }> {
    const rows = await this.fetchTransactionsForExport(jobData.userId, jobData.filters, jobData.walletAddress);
    const csvBuffer = this.toCsv(rows);
    const fileKey = `exports/transactions/${jobData.userId}/${Date.now()}.csv`;
    await this.uploadFile(fileKey, csvBuffer, 'text/csv; charset=utf-8');
    return { fileKey };
  }

  private async assertTransactionOwnership(
    userId: string,
    transactionId: string,
    walletAddress?: string,
  ): Promise<void> {
    const tx = await this.getOwnedTransaction(userId, transactionId, walletAddress);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
  }

  private async getOwnedTransaction(
    userId: string,
    transactionId: string,
    walletAddress?: string,
  ): Promise<TransactionRow | null> {
    const addresses = await this.resolveUserAddresses(userId, walletAddress);
    if (!addresses.length) {
      return null;
    }

    const rows = await this.walletsRepository.manager.query(
      `
      SELECT
        tx."id",
        tx."txHash",
        tx."fromAddress",
        tx."toAddress",
        tx."tokenId",
        tx."amount",
        tx."fee",
        tx."status",
        tx."type",
        tx."conversationId",
        tx."messageId",
        tx."network",
        tx."ledger",
        tx."confirmedAt",
        tx."createdAt"
      FROM "transactions" tx
      WHERE tx."id" = $1
        AND (
          LOWER(tx."fromAddress") = ANY($2)
          OR LOWER(tx."toAddress") = ANY($2)
        )
      LIMIT 1
      `,
      [transactionId, addresses],
    );

    return (rows[0] as TransactionRow | undefined) ?? null;
  }

  private async fetchTransactionsForExport(
    userId: string,
    filters: ExportTransactionsDto,
    walletAddress?: string,
  ): Promise<TransactionRow[]> {
    const addresses = await this.resolveUserAddresses(userId, walletAddress);
    if (!addresses.length) {
      return [];
    }

    const whereParts = [
      `(LOWER(tx."fromAddress") = ANY($1) OR LOWER(tx."toAddress") = ANY($1))`,
    ];
    const params: unknown[] = [addresses];
    let idx = 2;

    if (filters.startDate) {
      whereParts.push(`tx."createdAt" >= $${idx}`);
      params.push(new Date(filters.startDate));
      idx += 1;
    }

    if (filters.endDate) {
      whereParts.push(`tx."createdAt" <= $${idx}`);
      params.push(new Date(filters.endDate));
      idx += 1;
    }

    if (filters.token) {
      whereParts.push(`LOWER(tx."tokenId") = LOWER($${idx})`);
      params.push(filters.token);
      idx += 1;
    }

    if (filters.type) {
      whereParts.push(`tx."type" = $${idx}`);
      params.push(filters.type);
      idx += 1;
    }

    const sql = `
      SELECT
        tx."id",
        tx."txHash",
        tx."fromAddress",
        tx."toAddress",
        tx."tokenId",
        tx."amount",
        tx."fee",
        tx."status",
        tx."type",
        tx."conversationId",
        tx."messageId",
        tx."network",
        tx."ledger",
        tx."confirmedAt",
        tx."createdAt"
      FROM "transactions" tx
      WHERE ${whereParts.join(' AND ')}
      ORDER BY tx."createdAt" DESC
      LIMIT ${MAX_EXPORT_ROWS}
    `;

    return this.walletsRepository.manager.query(sql, params) as Promise<TransactionRow[]>;
  }

  private toCsv(rows: TransactionRow[]): Buffer {
    const headers = [
      'id',
      'txHash',
      'sender',
      'recipient',
      'amount',
      'token',
      'fee',
      'timestamp',
      'status',
      'type',
      'conversationId',
      'messageId',
      'network',
      'ledger',
      'stellarExplorerUrl',
    ];

    const lines = rows.map((row) => {
      const timestamp = (row.confirmedAt ?? row.createdAt).toISOString();
      const explorerUrl = this.buildExplorerUrl(row.network, row.txHash);
      return [
        row.id,
        row.txHash,
        row.fromAddress,
        row.toAddress,
        row.amount,
        row.tokenId,
        row.fee,
        timestamp,
        row.status,
        row.type,
        row.conversationId ?? '',
        row.messageId ?? '',
        row.network,
        row.ledger ?? '',
        explorerUrl,
      ]
        .map((value) => this.csvEscape(value))
        .join(',');
    });

    return Buffer.from([headers.join(','), ...lines].join('\n'), 'utf8');
  }

  private csvEscape(value: string): string {
    const normalized = value.replaceAll('"', '""');
    return `"${normalized}"`;
  }

  private async resolveUserAddresses(userId: string, walletAddress?: string): Promise<string[]> {
    const wallets = await this.walletsRepository.find({
      where: { userId },
      select: ['walletAddress'],
    });

    const values = wallets.map((wallet) => wallet.walletAddress.toLowerCase());
    if (walletAddress) {
      values.push(walletAddress.toLowerCase());
    }

    return Array.from(new Set(values));
  }

  private validateExportRange(filters: ExportTransactionsDto): void {
    if (!filters.startDate || !filters.endDate) {
      return;
    }

    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    if (start > end) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }
  }

  private buildExplorerUrl(network: string, txHash: string): string {
    const normalized = network.toLowerCase();
    const base = normalized.includes('testnet')
      ? 'https://stellar.expert/explorer/testnet/tx'
      : 'https://stellar.expert/explorer/public/tx';
    return `${base}/${txHash}`;
  }

  private receiptJobId(userId: string, transactionId: string): string {
    return `${RECEIPT_JOB_PREFIX}:${userId}:${transactionId}`;
  }

  private receiptFileKey(userId: string, transactionId: string): string {
    return `receipts/${userId}/${transactionId}.pdf`;
  }

  private async buildReceiptUrlResponse(
    transactionId: string,
    fileKey: string | undefined,
  ): Promise<ReceiptUrlResponseDto> {
    if (!fileKey) {
      throw new NotFoundException('Receipt file not available');
    }

    const { url, expiresAt } = await this.createDownloadUrl(fileKey);
    return {
      transactionId,
      url,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async uploadFile(fileKey: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.storageBucket) {
      throw new BadRequestException('Storage bucket is not configured');
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.storageBucket,
        Key: fileKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  private async objectExists(fileKey: string): Promise<boolean> {
    if (!this.storageBucket) {
      return false;
    }
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.storageBucket,
          Key: fileKey,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private async createDownloadUrl(fileKey: string): Promise<{ url: string; expiresAt: Date }> {
    if (!this.storageBucket) {
      this.logger.error('Storage bucket is not configured');
      throw new BadRequestException('Storage bucket is not configured');
    }

    const url = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.storageBucket,
        Key: fileKey,
      }),
      { expiresIn: this.downloadTtlSeconds },
    );

    return {
      url,
      expiresAt: new Date(Date.now() + this.downloadTtlSeconds * 1000),
    };
  }

  private mapJobStatus(state: string): string {
    if (state === 'completed') {
      return 'completed';
    }
    if (state === 'failed') {
      return 'failed';
    }
    if (state === 'active') {
      return 'processing';
    }
    return 'queued';
  }
}
