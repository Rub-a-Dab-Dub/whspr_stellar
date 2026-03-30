import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  HistoryImportJob,
  ImportJobStatus,
} from './entities/history-import-job.entity';
import {
  HISTORY_IMPORT_QUEUE,
  HistoryImportJobData,
} from './processors/history-import.processor';
import { ImportStatusDto } from './dto/import-status.dto';

export interface StellarTxRecord {
  txHash: string;
  ledger: number;
  createdAt: string;
  sourceAccount: string;
  feeCharged: string;
  operationCount: number;
  successful: boolean;
  memo?: string;
  envelopeXdr: string;
  resultXdr: string;
}

const BATCH_SIZE = 200;

@Injectable()
export class StellarHistoryImporterService {
  private readonly logger = new Logger(StellarHistoryImporterService.name);
  private readonly horizonServer: StellarSdk.Horizon.Server;

  constructor(
    @InjectRepository(HistoryImportJob)
    private readonly jobRepo: Repository<HistoryImportJob>,
    @InjectQueue(HISTORY_IMPORT_QUEUE)
    private readonly importQueue: Queue<HistoryImportJobData>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    const horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );
    this.horizonServer = new StellarSdk.Horizon.Server(horizonUrl);
  }

  /**
   * Create a PENDING import job and enqueue it.
   * Any existing RUNNING jobs for the same wallet are marked FAILED (superseded).
   */
  async triggerImport(walletId: string, walletAddress: string): Promise<HistoryImportJob> {
    await this.jobRepo.update(
      { walletId, status: ImportJobStatus.RUNNING },
      { status: ImportJobStatus.FAILED, errorMessage: 'Superseded by new import job' },
    );

    const job = this.jobRepo.create({
      walletId,
      status: ImportJobStatus.PENDING,
      totalImported: 0,
    });
    const saved = await this.jobRepo.save(job);

    await this.importQueue.add(
      'import',
      { jobId: saved.id, walletId, walletAddress },
      { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
    );

    this.logger.log(`Import job ${saved.id} queued for wallet ${walletId}`);
    return saved;
  }

  /**
   * Execute a cursor-based full history import.
   * Saves progress after each page so the job is resumable on retry.
   */
  async importHistory(
    jobId: string,
    walletId: string,
    walletAddress: string,
  ): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Import job ${jobId} not found`);

    await this.jobRepo.update(jobId, { status: ImportJobStatus.RUNNING });

    try {
      let totalImported = job.totalImported;
      let cursor = job.cursor ?? undefined;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const page = await this.fetchTransactionPage(walletAddress, cursor);
        if (page.length === 0) break;

        const deduped = await this.deduplicateByTxHash(walletId, page);

        if (deduped.length > 0) {
          await this.persistTransactions(walletId, deduped);
          totalImported += deduped.length;
        }

        cursor = page[page.length - 1].txHash;
        await this.jobRepo.update(jobId, { totalImported, cursor });

        if (page.length < BATCH_SIZE) break;
      }

      await this.jobRepo.update(jobId, {
        status: ImportJobStatus.COMPLETED,
        totalImported,
        cursor,
        completedAt: new Date(),
      });

      this.logger.log(`Job ${jobId} completed — ${totalImported} tx imported for wallet ${walletId}`);

      this.eventEmitter.emit('wallet.history.imported', { walletId, jobId, totalImported });
    } catch (error) {
      await this.jobRepo.update(jobId, {
        status: ImportJobStatus.FAILED,
        errorMessage: (error as Error).message,
      });
      throw error;
    }
  }

  /** Fetch up to BATCH_SIZE transactions from Horizon starting after `cursor`. */
  async fetchTransactionPage(
    walletAddress: string,
    cursor?: string,
  ): Promise<StellarTxRecord[]> {
    let builder = this.horizonServer
      .transactions()
      .forAccount(walletAddress)
      .limit(BATCH_SIZE)
      .order('asc');

    if (cursor) builder = builder.cursor(cursor);

    const response = await builder.call();
    return response.records.map((r) => this.mapHorizonTxToInternal(r));
  }

  /** Map a raw Horizon transaction record to the internal representation. */
  mapHorizonTxToInternal(record: any): StellarTxRecord {
    return {
      txHash: record.hash,
      ledger: record.ledger,
      createdAt: record.created_at,
      sourceAccount: record.source_account,
      feeCharged: record.fee_charged,
      operationCount: record.operation_count,
      successful: record.successful,
      memo: record.memo,
      envelopeXdr: record.envelope_xdr,
      resultXdr: record.result_xdr,
    };
  }

  /** Remove transactions already stored for this wallet. */
  async deduplicateByTxHash(
    walletId: string,
    records: StellarTxRecord[],
  ): Promise<StellarTxRecord[]> {
    if (records.length === 0) return [];
    const hashes = records.map((r) => r.txHash);
    try {
      const existing: { txHash: string }[] = await this.jobRepo.manager.query(
        `SELECT "txHash" FROM stellar_imported_transactions WHERE "walletId" = $1 AND "txHash" = ANY($2)`,
        [walletId, hashes],
      );
      const existingSet = new Set(existing.map((r) => r.txHash));
      return records.filter((r) => !existingSet.has(r.txHash));
    } catch {
      // Table may not exist on first run — return all records.
      return records;
    }
  }

  /** Resume an existing job from its saved cursor. */
  async resumeFromCursor(jobId: string, walletAddress: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Import job ${jobId} not found`);
    await this.importHistory(jobId, job.walletId, walletAddress);
  }

  /** Fetch the latest import status for a wallet. */
  async getImportStatus(walletId: string): Promise<ImportStatusDto> {
    const job = await this.jobRepo.findOne({
      where: { walletId },
      order: { startedAt: 'DESC' },
    });
    if (!job) throw new NotFoundException(`No import job found for wallet ${walletId}`);

    return {
      jobId: job.id,
      walletId: job.walletId,
      status: job.status,
      totalImported: job.totalImported,
      cursor: job.cursor,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };
  }

  /** Sync only new transactions since the last completed import cursor. */
  async syncNewTransactions(walletId: string, walletAddress: string): Promise<number> {
    const latestJob = await this.jobRepo.findOne({
      where: { walletId, status: ImportJobStatus.COMPLETED },
      order: { completedAt: 'DESC' },
    });

    const cursor = latestJob?.cursor;
    const page = await this.fetchTransactionPage(walletAddress, cursor);
    const deduped = await this.deduplicateByTxHash(walletId, page);

    if (deduped.length > 0) await this.persistTransactions(walletId, deduped);
    return deduped.length;
  }

  private async persistTransactions(
    walletId: string,
    records: StellarTxRecord[],
  ): Promise<void> {
    if (records.length === 0) return;

    await this.jobRepo.manager.query(`
      CREATE TABLE IF NOT EXISTS stellar_imported_transactions (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "walletId"    UUID NOT NULL,
        "txHash"      VARCHAR(64) NOT NULL UNIQUE,
        ledger        INTEGER NOT NULL,
        "createdAt"   TIMESTAMP NOT NULL,
        "sourceAccount" VARCHAR(56) NOT NULL,
        "feeCharged"  VARCHAR(20),
        "operationCount" INTEGER,
        successful    BOOLEAN,
        memo          TEXT,
        "envelopeXdr" TEXT,
        "resultXdr"   TEXT,
        "importedAt"  TIMESTAMP DEFAULT now()
      )
    `);

    const values = records
      .map((_, i) =>
        `($${i * 11 + 1},$${i * 11 + 2},$${i * 11 + 3},$${i * 11 + 4},$${i * 11 + 5},$${i * 11 + 6},$${i * 11 + 7},$${i * 11 + 8},$${i * 11 + 9},$${i * 11 + 10},$${i * 11 + 11})`,
      )
      .join(',');

    const params: any[] = [];
    for (const r of records) {
      params.push(
        walletId, r.txHash, r.ledger, r.createdAt, r.sourceAccount,
        r.feeCharged, r.operationCount, r.successful, r.memo ?? null,
        r.envelopeXdr, r.resultXdr,
      );
    }

    await this.jobRepo.manager.query(
      `INSERT INTO stellar_imported_transactions
         ("walletId","txHash",ledger,"createdAt","sourceAccount","feeCharged","operationCount",successful,memo,"envelopeXdr","resultXdr")
       VALUES ${values}
       ON CONFLICT ("txHash") DO NOTHING`,
      params,
    );
  }
}
