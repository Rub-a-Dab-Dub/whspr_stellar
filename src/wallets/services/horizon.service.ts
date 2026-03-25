import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from 'stellar-sdk';
import { AssetBalanceDto } from '../dto/balance-response.dto';
import { WalletNetwork } from '../entities/wallet.entity';

@Injectable()
export class HorizonService {
  private readonly logger = new Logger(HorizonService.name);

  private readonly servers: Record<WalletNetwork, StellarSdk.Horizon.Server>;

  constructor(private readonly configService: ConfigService) {
    this.servers = {
      [WalletNetwork.STELLAR_MAINNET]: new StellarSdk.Horizon.Server(
        configService.get<string>(
          'STELLAR_HORIZON_MAINNET_URL',
          'https://horizon.stellar.org',
        ),
      ),
      [WalletNetwork.STELLAR_TESTNET]: new StellarSdk.Horizon.Server(
        configService.get<string>(
          'STELLAR_HORIZON_TESTNET_URL',
          'https://horizon-testnet.stellar.org',
        ),
      ),
    };
  }

  /**
   * Fetch all asset balances for a Stellar account from Horizon.
   * Throws NotFoundException when the account does not exist on-chain yet.
   */
  async getBalances(
    walletAddress: string,
    network: WalletNetwork = WalletNetwork.STELLAR_MAINNET,
  ): Promise<AssetBalanceDto[]> {
    const server = this.servers[network];

    try {
      const account = await server.loadAccount(walletAddress);

      return account.balances.map((b) => {
        const isNative = b.asset_type === 'native';
        const isLiquidityPool = b.asset_type === 'liquidity_pool_shares';
        const assetLine = b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset;

        return {
          assetCode: isNative ? 'XLM' : isLiquidityPool ? 'LP' : assetLine.asset_code ?? 'UNKNOWN',
          assetType: b.asset_type,
          assetIssuer: isNative || isLiquidityPool ? null : assetLine.asset_issuer ?? null,
          balance: b.balance,
          buyingLiabilities: isLiquidityPool ? '0.0000000' : (b as StellarSdk.Horizon.HorizonApi.BalanceLineNative).buying_liabilities ?? '0.0000000',
          sellingLiabilities: isLiquidityPool ? '0.0000000' : (b as StellarSdk.Horizon.HorizonApi.BalanceLineNative).selling_liabilities ?? '0.0000000',
        };
      });
    } catch (error: any) {
      if (error?.response?.status === 404) {
        throw new NotFoundException(
          `Stellar account ${walletAddress} not found on ${network}. Fund it with at least 1 XLM to activate.`,
        );
      }
      this.logger.error(`Horizon error for ${walletAddress}: ${error?.message}`);
      throw error;
    }
  }

  /** Validate that a Stellar address is well-formed. */
  isValidAddress(address: string): boolean {
    return StellarSdk.StrKey.isValidEd25519PublicKey(address);
  }

  /** Build the canonical verification message for wallet ownership proof. */
  buildVerificationMessage(walletAddress: string, userId: string): string {
    return `Verify wallet ownership for Gasless Gossip\nWallet: ${walletAddress}\nUser: ${userId}\nThis request will not trigger a blockchain transaction or cost any fees.`;
  }
}
