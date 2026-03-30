import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { AmlMonitoringService } from './aml-monitoring.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface AnalyzeTransactionJob {
  txId: string;
}

@Processor('aml-analysis')
@Injectable()
export class AmlProcessor {
  private readonly logger = new Logger(AmlProcessor.name);

  constructor(
    private readonly amlService: AmlMonitoringService,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  @Process('analyze-transaction')
  async handleAnalyzeTransaction(job: Job<AnalyzeTransactionJob>) {
    const { txId } = job.data;
    this.logger.log(`Analyzing transaction ${txId} for AML`);

    try {
      const tx = await this.txRepo.findOne({ 
        where: { id: txId, status: 'CONFIRMED' },
        relations: ['sender'],
      });

      if (!tx) {
        this.logger.warn(`Transaction ${txId} not confirmed, skipping AML`);
        return;
      }

      const flag = await this.amlService.analyzeTransaction(tx);
      if (flag) {
        this.logger.warn(`AML Flag generated for TX ${txId}: ${flag.id}`);
      }
    } catch (error) {
      this.logger.error(`AML analysis failed for ${txId}: ${error.message}`, error.stack);
    }
  }
}

