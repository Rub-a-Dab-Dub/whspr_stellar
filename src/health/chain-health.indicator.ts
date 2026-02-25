import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChainHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(ChainHealthIndicator.name);
  private readonly chains: { name: string; rpcUrl: string }[];
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    super();
    this.timeoutMs = 3000;
    this.chains = [
      { name: 'bnb', rpcUrl: this.configService.get<string>('BNB_RPC_URL', 'https://bsc-dataseed.binance.org') },
      { name: 'celo', rpcUrl: this.configService.get<string>('CELO_RPC_URL', 'https://forno.celo.org') },
      { name: 'base', rpcUrl: this.configService.get<string>('BASE_RPC_URL', 'https://mainnet.base.org') },
    ];
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const results: Record<string, { status: string; responseTime?: number; error?: string }> = {};
    let allHealthy = true;

    await Promise.all(
      this.chains.map(async (chain) => {
        const start = Date.now();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

          const response = await fetch(chain.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
            signal: controller.signal,
          });

          clearTimeout(timeout);
          const responseTime = Date.now() - start;

          if (response.ok) {
            results[chain.name] = { status: 'up', responseTime };
          } else {
            results[chain.name] = { status: 'down', responseTime, error: `HTTP ${response.status}` };
            allHealthy = false;
          }
        } catch (error) {
          results[chain.name] = { status: 'down', responseTime: Date.now() - start, error: (error as Error).message };
          allHealthy = false;
        }
      }),
    );

    const result = this.getStatus('chains', allHealthy, results);
    if (!allHealthy) {
      throw new HealthCheckError('Chain health check failed', result);
    }
    return result;
  }
}
