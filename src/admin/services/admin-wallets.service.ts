import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Request } from 'express';
import { In, Repository } from 'typeorm';
import { ethers } from 'ethers';

import { User } from '../../user/entities/user.entity';
import { Transfer } from '../../transfer/entities/transfer.entity';
import { ChainService } from '../../chain/chain.service';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { AuditLogService } from './audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { GetAdminWalletsDto } from '../dto/get-admin-wallets.dto';
import { SyncWalletsDto } from '../dto/sync-wallets.dto';

type WalletStatus = 'active' | 'failed' | 'pending';

type WalletCreationJobState = {
  status: WalletStatus;
  jobId: string;
  chain?: string;
  failedReason?: string;
  progress?: number;
};

type WalletSyncSnapshot = {
  balance?: string;
  lastSyncedAt?: Date;
};

@Injectable()
export class AdminWalletsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    private readonly chainService: ChainService,
    private readonly auditLogService: AuditLogService,
    @InjectQueue(QUEUE_NAMES.WALLET_CREATION)
    private readonly walletCreationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.BLOCKCHAIN_TASKS)
    private readonly blockchainQueue: Queue,
  ) {}

  async listWallets(
    query: GetAdminWalletsDto,
    actorUserId: string,
    req?: Request,
  ) {
    const walletJobStateByUserId = await this.getWalletCreationJobStateByUserId();
    const syncSnapshotByUserAndChain = await this.getLatestSyncSnapshotMap();

    const queuedUserIds = [...walletJobStateByUserId.keys()];
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.walletAddress IS NOT NULL')
      .orWhere(queuedUserIds.length > 0 ? 'user.id IN (:...queuedUserIds)' : '1=0', {
        queuedUserIds,
      })
      .getMany();

    let wallets = await Promise.all(
      users.map((user) =>
        this.toWalletListItem(
          user,
          query.chain,
          walletJobStateByUserId.get(user.id as string),
          syncSnapshotByUserAndChain,
        ),
      ),
    );

    wallets = wallets.filter((wallet) => {
      if (query.status && wallet.status !== query.status) return false;
      if (query.chain && wallet.chain !== query.chain) return false;
      if (query.minBalance !== undefined && Number(wallet.balance) < query.minBalance)
        return false;
      if (query.maxBalance !== undefined && Number(wallet.balance) > query.maxBalance)
        return false;
      if (query.startDate && wallet.createdAt < new Date(query.startDate)) return false;
      if (query.endDate && wallet.createdAt > new Date(query.endDate)) return false;
      return true;
    });

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = (query.sortOrder || 'DESC').toUpperCase();

    wallets.sort((a, b) => {
      let left: number;
      let right: number;

      if (sortBy === 'balance') {
        left = Number(a.balance);
        right = Number(b.balance);
      } else if (sortBy === 'lastSyncedAt') {
        left = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
        right = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
      } else {
        left = new Date(a.createdAt).getTime();
        right = new Date(b.createdAt).getTime();
      }

      return sortOrder === 'ASC' ? left - right : right - left;
    });

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const paginated = wallets.slice(skip, skip + limit);

    await this.auditLogService.createAuditLog({
      actorUserId,
      action: AuditAction.VIEW_WALLET,
      eventType: AuditEventType.ADMIN,
      severity: AuditSeverity.LOW,
      resourceType: 'wallet',
      details: 'Listed user wallets',
      metadata: { filters: query, count: paginated.length },
      req,
    });

    return {
      items: paginated,
      total: wallets.length,
      page,
      limit,
    };
  }

  async getWalletDetail(
    walletAddress: string,
    actorUserId: string,
    req?: Request,
  ) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.walletAddress) = LOWER(:walletAddress)', { walletAddress })
      .getOne();

    if (!user) {
      throw new NotFoundException('Wallet not found');
    }

    const walletJobStateByUserId = await this.getWalletCreationJobStateByUserId();
    const syncSnapshotByUserAndChain = await this.getLatestSyncSnapshotMap();

    const wallet = await this.toWalletListItem(
      user,
      undefined,
      walletJobStateByUserId.get(user.id as string),
      syncSnapshotByUserAndChain,
    );

    const transactions = await this.transferRepository
      .createQueryBuilder('transfer')
      .where(
        '(transfer.senderId = :userId OR transfer.recipientId = :userId) AND transfer.transactionHash IS NOT NULL',
        { userId: user.id },
      )
      .orderBy('transfer.createdAt', 'DESC')
      .take(20)
      .getMany();

    const mappedTransactions = transactions.map((tx) => ({
      id: tx.id,
      transactionHash: tx.transactionHash,
      chain: tx.blockchainNetwork,
      amount: tx.amount,
      status: tx.status,
      senderId: tx.senderId,
      recipientId: tx.recipientId,
      createdAt: tx.createdAt,
    }));

    const walletCreationStatus =
      wallet.status === 'pending'
        ? walletJobStateByUserId.get(user.id as string) || null
        : null;

    await this.auditLogService.createAuditLog({
      actorUserId,
      targetUserId: user.id,
      action: AuditAction.VIEW_WALLET,
      eventType: AuditEventType.ADMIN,
      severity: AuditSeverity.LOW,
      resourceType: 'wallet',
      resourceId: walletAddress.toLowerCase(),
      details: 'Viewed wallet details',
      req,
    });

    return {
      ...wallet,
      transactions: mappedTransactions,
      walletCreationJobStatus: walletCreationStatus,
      userProfileSummary: {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isBanned: user.isBanned,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    };
  }

  async retryWalletCreation(
    userId: string,
    actorUserId: string,
    req?: Request,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.walletAddress) {
      throw new ConflictException(
        'Wallet already exists and is active for this user',
      );
    }

    const walletJobStateByUserId = await this.getWalletCreationJobStateByUserId();
    const walletState = walletJobStateByUserId.get(userId);

    if (!walletState || walletState.status !== 'failed') {
      throw new BadRequestException(
        'Wallet creation retry is only valid for failed wallets',
      );
    }

    const job = await this.walletCreationQueue.add(
      {
        userId,
        chain: walletState.chain || 'stellar',
        retryOfJobId: walletState.jobId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    await this.auditLogService.createAuditLog({
      actorUserId,
      targetUserId: userId,
      action: AuditAction.RETRY_WALLET_CREATION,
      eventType: AuditEventType.ADMIN,
      severity: AuditSeverity.MEDIUM,
      resourceType: 'wallet',
      resourceId: userId,
      details: 'Retried wallet creation',
      metadata: { newJobId: job.id?.toString(), previousJobId: walletState.jobId },
      req,
    });

    return {
      jobId: job.id?.toString(),
      status: 'queued',
    };
  }

  async syncWallets(dto: SyncWalletsDto, actorUserId: string, req?: Request) {
    let users: User[];
    if (dto.userIds?.length) {
      users = await this.userRepository.find({
        where: { id: In(dto.userIds) },
      });
    } else {
      users = await this.userRepository
        .createQueryBuilder('user')
        .where('user.walletAddress IS NOT NULL')
        .getMany();
    }

    const targetWallets = users
      .filter((user) => !!user.walletAddress)
      .map((user) => ({
        userId: user.id,
        walletAddress: user.walletAddress,
        chain: dto.chain || 'stellar',
      }));

    if (!targetWallets.length) {
      throw new BadRequestException('No wallets found for sync');
    }

    const job = await this.blockchainQueue.add(
      {
        taskType: 'balance_check',
        params: {
          wallets: targetWallets,
          chain: dto.chain || 'all',
          initiatedBy: actorUserId,
          requestedAt: new Date().toISOString(),
        },
      },
      {
        attempts: 2,
        backoff: { type: 'fixed', delay: 1000 },
      },
    );

    await this.auditLogService.createAuditLog({
      actorUserId,
      action: AuditAction.SYNC_WALLETS,
      eventType: AuditEventType.ADMIN,
      severity: AuditSeverity.MEDIUM,
      resourceType: 'wallet',
      details: 'Triggered wallet balance sync',
      metadata: {
        chain: dto.chain || null,
        userIds: dto.userIds || null,
        jobId: job.id?.toString(),
        count: targetWallets.length,
      },
      req,
    });

    return {
      jobId: job.id?.toString(),
      queuedWallets: targetWallets.length,
    };
  }

  private async toWalletListItem(
    user: User,
    preferredChain: string | undefined,
    jobState: WalletCreationJobState | undefined,
    syncSnapshotByUserAndChain: Map<string, WalletSyncSnapshot>,
  ) {
    const chain = preferredChain || jobState?.chain || 'stellar';
    const status: WalletStatus = user.walletAddress
      ? 'active'
      : jobState?.status || 'pending';

    const syncKey = `${user.id}:${chain}`;
    const snapshot = syncSnapshotByUserAndChain.get(syncKey);
    const liveBalance =
      user.walletAddress && status === 'active'
        ? await this.tryGetLiveBalance(user.walletAddress, chain)
        : null;

    return {
      userId: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      chain,
      balance: liveBalance ?? snapshot?.balance ?? '0',
      lastSyncedAt: liveBalance ? new Date().toISOString() : snapshot?.lastSyncedAt || null,
      createdAt: user.createdAt || new Date(0),
      status,
    };
  }

  private async getWalletCreationJobStateByUserId(): Promise<
    Map<string, WalletCreationJobState>
  > {
    const map = new Map<string, WalletCreationJobState>();
    const jobs = await this.walletCreationQueue.getJobs(
      ['active', 'waiting', 'delayed', 'failed'],
      0,
      1000,
      true,
    );

    for (const job of jobs) {
      const userId = job?.data?.userId;
      if (!userId || map.has(userId)) continue;

      const state = await job.getState();
      const status: WalletStatus =
        state === 'failed' ? 'failed' : 'pending';

      map.set(userId, {
        status,
        jobId: String(job.id),
        chain: job?.data?.chain || job?.data?.walletType,
        failedReason: job.failedReason,
        progress: Number(job.progress() || 0),
      });
    }

    return map;
  }

  private async getLatestSyncSnapshotMap(): Promise<Map<string, WalletSyncSnapshot>> {
    const map = new Map<string, WalletSyncSnapshot>();
    const jobs = await this.blockchainQueue.getJobs(['completed'], 0, 1000, true);

    for (const job of jobs) {
      const taskType = job?.data?.taskType;
      if (taskType !== 'balance_check') continue;

      const wallets = job?.data?.params?.wallets;
      if (!Array.isArray(wallets)) continue;

      for (const wallet of wallets) {
        const userId = wallet?.userId;
        const chain = wallet?.chain || job?.data?.params?.chain || 'stellar';
        if (!userId) continue;
        const key = `${userId}:${chain}`;

        const finishedAt = job.finishedOn ? new Date(job.finishedOn) : undefined;
        if (!finishedAt) continue;

        const existing = map.get(key);
        if (!existing || (existing.lastSyncedAt || new Date(0)) < finishedAt) {
          map.set(key, {
            balance: this.extractBalanceFromJob(job),
            lastSyncedAt: finishedAt,
          });
        }
      }
    }

    return map;
  }

  private extractBalanceFromJob(job: any): string | undefined {
    const result = job?.returnvalue;
    if (typeof result?.balance === 'string') {
      return result.balance;
    }
    return undefined;
  }

  private async tryGetLiveBalance(
    walletAddress: string,
    chain: string,
  ): Promise<string | null> {
    try {
      if (!(Object.values(SupportedChain) as string[]).includes(chain)) {
        return null;
      }
      const provider = this.chainService.getProvider(chain as SupportedChain);
      const balance = await provider.getBalance(walletAddress);
      return ethers.formatEther(balance);
    } catch {
      return null;
    }
  }
}
