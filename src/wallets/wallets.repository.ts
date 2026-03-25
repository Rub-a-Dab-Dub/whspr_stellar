import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Wallet, WalletNetwork } from './entities/wallet.entity';

@Injectable()
export class WalletsRepository extends Repository<Wallet> {
  constructor(private dataSource: DataSource) {
    super(Wallet, dataSource.createEntityManager());
  }

  findByUserId(userId: string): Promise<Wallet[]> {
    return this.find({
      where: { userId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  findByUserAndId(userId: string, id: string): Promise<Wallet | null> {
    return this.findOne({ where: { userId, id } });
  }

  findPrimaryByUserId(userId: string): Promise<Wallet | null> {
    return this.findOne({ where: { userId, isPrimary: true } });
  }

  findByUserAndAddress(userId: string, walletAddress: string): Promise<Wallet | null> {
    return this.findOne({ where: { userId, walletAddress } });
  }

  countByUserId(userId: string): Promise<number> {
    return this.count({ where: { userId } });
  }

  /** Atomically clear isPrimary on all user wallets then set it on one. */
  async transferPrimary(userId: string, newPrimaryId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Wallet, { userId }, { isPrimary: false });
      await manager.update(Wallet, { userId, id: newPrimaryId }, { isPrimary: true });
    });
  }

  findByAddress(walletAddress: string, network: WalletNetwork): Promise<Wallet | null> {
    return this.findOne({ where: { walletAddress, network } });
  }
}
