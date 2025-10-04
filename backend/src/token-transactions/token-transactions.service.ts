import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ethers } from 'ethers';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { SimulateTransactionDto } from './dto/simulate-transaction.dto';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto';

@Injectable()
export class TransactionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransactionsService.name);
  private ethersProvider: ethers.Provider;
  private listening = false;

  constructor(
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,
    private dataSource: DataSource,
    // inject other services like UsersService, AlertsService, HttpService for webhooks...
  ) {
    // provider config via env
    this.ethersProvider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  }

  async onModuleInit() {
    this.startEthersListeners();
  }
  onModuleDestroy() {
    // cleanup if needed
  }

  // Create a record for a simulated or real upcoming tx
  async create(dto: CreateTransactionDto) {
    const tx = this.txRepo.create({
      traceId: dto.traceId || uuidv4(),
      amount: dto.amount,
      tokenSymbol: dto.tokenSymbol || 'TOKEN',
      meta: dto.meta || {},
      status: TransactionStatus.PENDING,
      // optionally fill sender/receiver relation via ids in your app
    });
    return this.txRepo.save(tx);
  }

  // Simulate tx: create entry + optionally generate fake txHash & confirm later
  async simulate(dto: SimulateTransactionDto) {
    const trace = dto.traceId || uuidv4();
    const tx = this.txRepo.create({
      traceId: trace,
      amount: dto.amount,
      tokenSymbol: dto.tokenSymbol || 'TOKEN',
      status: TransactionStatus.PENDING,
      meta: { simulated: true, ...(dto.meta || {}) },
    });
    const saved = await this.txRepo.save(tx);

    // Optionally immediately generate a fake txHash for UI/testing
    const fakeHash = '0x' + Buffer.from(uuidv4()).toString('hex').slice(0, 64);
    saved.txHash = fakeHash;
    // auto-confirm simulated tx after small delay (for test)
    saved.status = TransactionStatus.CONFIRMED;
    saved.confirmedAt = new Date();
    await this.txRepo.save(saved);

    // run fraud check & alerts
    await this.postProcess(saved);

    return saved;
  }

  async findOneByTrace(traceId: string) {
    return this.txRepo.findOne({ where: { traceId } });
  }

  async findByTxHash(txHash: string) {
    return this.txRepo.findOne({ where: { txHash } });
  }

  async list({ skip = 0, take = 50 } = {}) {
    return this.txRepo.find({ order: { createdAt: 'DESC' }, skip, take });
  }

  // Reverse a failed/confirmed tx (logical reverse)
  async reverse(dto: ReverseTransactionDto) {
    const tx = await this.txRepo.findOne({ where: { traceId: dto.traceId } });
    if (!tx) throw new Error('Transaction not found');
    if (tx.status === TransactionStatus.REVERSED) return tx;

    // mark reversed
    tx.status = TransactionStatus.REVERSED;
    tx.meta = {
      ...(tx.meta || {}),
      reverseReason: dto.reason,
      reversedAt: new Date().toISOString(),
    };
    const saved = await this.txRepo.save(tx);

    // create a compensating accounting record in your ledger elsewhere (not included)
    // optionally notify parties

    return saved;
  }

  // Void dispute (soft delete/void)
  async voidDispute(traceId: string, reason?: string) {
    const tx = await this.txRepo.findOne({ where: { traceId } });
    if (!tx) throw new Error('Transaction not found');
    tx.status = TransactionStatus.VOIDED;
    tx.meta = {
      ...(tx.meta || {}),
      voidReason: reason,
      voidedAt: new Date().toISOString(),
    };
    return this.txRepo.save(tx);
  }

  // Accept a confirmed on-chain tx
  async acceptOnChainTx(txHash: string, receipt: ethers.TransactionReceipt) {
    let tx = await this.findByTxHash(txHash);
    if (!tx) {
      // create a record if missing
      tx = this.txRepo.create({
        traceId: `onchain-${txHash}`,
        txHash,
        amount: '0',
        status: TransactionStatus.CONFIRMED,
        meta: { receipt },
        confirmedAt: new Date(),
      });
    } else {
      tx.status = TransactionStatus.CONFIRMED;
      tx.confirmedAt = new Date();
      tx.meta = { ...(tx.meta || {}), receipt };
    }
    await this.txRepo.save(tx);
    await this.postProcess(tx);
    return tx;
  }

  // Post-process: fraud check, alerts for >$1000, update metrics
  private async postProcess(tx: Transaction) {
    const flagged = this.fraudCheckStub(tx);
    if (flagged) {
      tx.flaggedFraud = true;
      await this.txRepo.save(tx);
      // call AlertsService.raise('FRAUD_DETECTED', {...})
      this.logger.warn(`Fraud flagged for tx ${tx.traceId}`);
    }

    const usdValue = await this.estimateUsdValue(tx.amount, tx.tokenSymbol);
    if (usdValue > 1000) {
      // trigger high-value alert (webhook/email/push)
      this.logger.log(
        `High value tx > $1000: trace=${tx.traceId} usd=${usdValue}`,
      );
      // send alert via AlertsService
    }
  }

  // Simple USD estimation — replace with price oracle
  private async estimateUsdValue(amount: string, token = 'TOKEN') {
    // naive: if token is ETH or a known token, call price feed; here stub:
    const price = token === 'ETH' ? 2000 : 1; // stubbed values
    return parseFloat(amount) * price;
  }

  // Very small ML stub for fraud patterns
  private fraudCheckStub(tx: Transaction): boolean {
    // Example heuristics:
    // - many transactions from same sender in short window with similar amounts
    // - amount exactly the same across many transactions
    // - meta.simulated false positives ignored
    if (tx.meta?.simulated) return false;
    const amountNum = Number(tx.amount);
    if (isNaN(amountNum)) return false;

    // Simple heuristic: amounts that are round and repeated and > small threshold
    if (amountNum >= 50 && amountNum % 10 === 0) return true; // example
    return false;
  }

  // Cron job to sync balances every 5 minutes
  @Cron('*/5 * * * *') // every 5 minutes
  async syncBalances() {
    this.logger.log('Running balance sync (every 5 min)...');

    // For each user with address, request onchain balance via ethers provider or an indexer
    // This is left as a stub — implement per your users table / addresses
    // Example pseudo:
    // const users = await this.usersService.findAllWithAddresses();
    // for (const u of users) {
    //   const balance = await this.ethersProvider.getBalance(u.address);
    //   await this.usersService.updateBalance(u.id, balance.toString());
    // }
  }

  // Start listening to on-chain events (transfer events etc.)
  private startEthersListeners() {
    if (this.listening) return;
    this.listening = true;
    const provider = this.ethersProvider;

    provider.on('pending', (txHash) => {
      // optional: capture pending txs
    });

    provider.on('block', async (blockNumber) => {
      this.logger.debug(`New block ${blockNumber}`);
      // optional: scan block for relevant txs using provider.getBlockWithTransactions
      // but avoid heavy work on main thread
    });

    // If listening to a contract transfer event:
    // const contract = new ethers.Contract(process.env.TOKEN_ADDRESS, ERC20_ABI, provider);
    // contract.on('Transfer', async (from, to, value, event) => { ... });

    // Instead, use txHash webhook / indexer for reliability
  }

  // inside TransactionsService
  async getTopSenders(limit = 10) {
    // raw SQL using Postgres aggregation for speed
    const rows = await this.dataSource.query(
      `
    SELECT "senderId" as "userId", SUM(amount::numeric) as total
    FROM token_transactions
    WHERE status = $1
    GROUP BY "senderId"
    ORDER BY total DESC
    LIMIT $2
    `,
      [TransactionStatus.CONFIRMED, limit],
    );

    // optionally map to user details via usersService
    return rows;
  }

  async findPendingTransactions() {
    return this.txRepo.find({
      where: { status: TransactionStatus.PENDING },
    });
  }
}
