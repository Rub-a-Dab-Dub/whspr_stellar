import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class TransferBalanceService {
  private readonly logger = new Logger(TransferBalanceService.name);
  private server: StellarSdk.Horizon.Server;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const horizonUrl =
      this.configService.get<string>('STELLAR_HORIZON_URL') ||
      'https://horizon-testnet.stellar.org';
    this.server = new StellarSdk.Horizon.Server(horizonUrl);
  }

  async getBalance(
    userId: string,
    network: string = 'stellar',
  ): Promise<number> {
    try {
      // In production, fetch user's wallet address from database
      // For now, this is a placeholder implementation
      const walletAddress = await this.getUserWalletAddress(userId, network);

      if (!walletAddress) {
        return 0;
      }

      if (network === 'stellar') {
        return await this.getStellarBalance(walletAddress);
      }

      // For other networks, implement EVM balance checking
      return 0;
    } catch (error) {
      this.logger.error(
        `Failed to get balance for user ${userId}: ${error.message}`,
      );
      return 0;
    }
  }

  private async getStellarBalance(publicKey: string): Promise<number> {
    try {
      const account = await this.server.loadAccount(publicKey);
      const nativeBalance = account.balances.find(
        (balance) => balance.asset_type === 'native',
      );

      return nativeBalance ? parseFloat(nativeBalance.balance) : 0;
    } catch (error) {
      this.logger.error(`Failed to get Stellar balance: ${error.message}`);
      return 0;
    }
  }

  private async getUserWalletAddress(
    userId: string,
    network: string,
  ): Promise<string | null> {
    // Stellar / default: use the user's walletAddress field
    // For EVM networks the same field stores an EVM address — extend here as needed
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'walletAddress'],
    });
    return user?.walletAddress ?? null;
  }

  async recordBalanceSnapshot(
    userId: string,
    network: string,
  ): Promise<string> {
    const balance = await this.getBalance(userId, network);
    return balance.toFixed(8);
  }
}
