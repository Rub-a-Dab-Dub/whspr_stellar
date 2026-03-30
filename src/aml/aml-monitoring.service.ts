import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AmlFlagsRepository } from './aml-flags.repository';
import { AmlFlag, AmlFlagType, AmlRiskLevel, AmlFlagStatus, ComplianceReport, ComplianceReportType } from './entities';
import { Transaction } from '../transactions/entities/transaction.entity';
import { MailService } from '../mail/mail.service';

interface AnalysisJobData {
  txId: string;
}

@Injectable()
export class AmlMonitoringService {
  private readonly logger = new Logger(AmlMonitoringService.name);
  private readonly LARGE_AMOUNT_USD = 10000;
  private readonly RAPID_TX_HOUR = 10;

  constructor(
    private readonly configService: ConfigService,
    private readonly repo: AmlFlagsRepository,
    @InjectQueue('aml-analysis') private readonly amlQueue: Queue<AnalysisJobData>,
    private readonly mailService: MailService,
  ) {
    this.LARGE_AMOUNT_USD = this.configService.get('AML_LARGE_AMOUNT_USD', 10000);
    this.RAPID_TX_HOUR = this.configService.get('AML_RAPID_TX_HOUR', 10);
  }

  async analyzeTransaction(tx: Transaction): Promise<AmlFlag | null> {
    const flags: AmlFlagType[] = [];
    let maxRisk = AmlRiskLevel.LOW;

    // 1. Large amount
    if (this.isLargeAmount(tx)) {
      flags.push(AmlFlagType.LARGE_AMOUNT);
      maxRisk = AmlRiskLevel.HIGH;
    }

    // 2. Rapid succession
    const recentTxCount = await this.getUserRecentTxCount(tx.fromAddress, 1);
    if (recentTxCount >= this.RAPID_TX_HOUR) {
      flags.push(AmlFlagType.RAPID_SUCCESSION);
      maxRisk = AmlRiskLevel[recentTxCount > 20 ? 'CRITICAL' : 'HIGH' as keyof typeof AmlRiskLevel];
    }

    // 3. Structuring (multiple small ~threshold)
    const structuringCount = await this.getStructuringPattern(tx.fromAddress, tx.amount);
    if (structuringCount >= 5) {
      flags.push(AmlFlagType.STRUCTURING);
      maxRisk = AmlRiskLevel.CRITICAL;
    }

    if (flags.length === 0) return null;

    const flag = await this.flagSuspicious(tx.id, tx.fromAddress, flags, maxRisk);
    if (flag.riskLevel === AmlRiskLevel.CRITICAL) {
      await this.mailService.sendAdminAlert(`Critical AML Flag: TX ${tx.id}`);
    }

    return flag;
  }

  async flagSuspicious(txId: string, userId: string | null, flagTypes: AmlFlagType[], riskLevel: AmlRiskLevel): Promise<AmlFlag> {
    const flag = this.repo.create({
      transactionId: txId,
      userId,
      flagType: flagTypes[0], // primary
      riskLevel,
      status: AmlFlagStatus.OPEN,
    });
    const saved = await this.repo.save(flag);
    this.logger.warn(`AML Flag created: ${saved.id} risk=${riskLevel} type=${flagTypes.join(',')}`);
    return saved;
  }

  async reviewFlag(flagId: string, action: 'review' | 'clear' | 'report', reviewerId: string, notes?: string): Promise<AmlFlag> {
    const flag = await this.repo.findOne({ where: { id: flagId } });
    if (!flag) throw new Error('Flag not found');

    flag.status = action === 'clear' ? AmlFlagStatus.CLEARED : 
                  action === 'report' ? AmlFlagStatus.REPORTED : AmlFlagStatus.REVIEWED;
    flag.reviewedBy = reviewerId;
    flag.reviewNotes = notes;

    return this.repo.save(flag);
  }

  async generateReport(type: ComplianceReportType, period = new Date().toISOString().slice(0, 7)): Promise<ComplianceReport> {
    // Query flagged tx for period
    const flags = await this.repo.find({
      where: { 
        status: AmlFlagStatus.REPORTED, 
        createdAt: this.getPeriodRange(period) 
      },
      relations: ['transaction'],
    });

    const report = this.repo.manager.create(ComplianceReport, {
      period,
      reportType: type,
      transactionIds: flags.map(f => f.transactionId),
      totalAmount: flags.reduce((sum, f) => sum + parseFloat(f.transaction!.amount), '0'),
      generatedAt: new Date(),
    });

    const saved = await this.repo.manager.save(report);
    // TODO: Generate PDF url
    return saved;
  }

  async getAMLDashboard() {
    return this.repo.getDashboardStats();
  }

  async runBatchAnalysis() {
    // Cron: analyze all confirmed tx in last hour without flags
    this.logger.log('Running AML batch analysis');
    // Implementation TBD
  }

  private async getUserRecentTxCount(fromAddress: string, hours: number): Promise<number> {
    // Mock - integrate with TransactionsRepository
    return 0;
  }

  private async getStructuringPattern(fromAddress: string, amount: string): Promise<number> {
    // Mock - detect multiple small tx
    return 0;
  }

  private isLargeAmount(tx: Transaction): boolean {
    // Simple USD check - extend for asset conversion
    return parseFloat(tx.amount) * 1 > this.LARGE_AMOUNT_USD; // Assume USDC=1USD
  }

  private getPeriodRange(period: string): any {
    const [year, month] = period.split('-');
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0);
    return { createdAt: Between(start, end) };
  }
}

