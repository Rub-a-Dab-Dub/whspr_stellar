// src/health/indicators/evm-rpc.indicator.ts
import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';

@Injectable()
export class EvmRpcHealthIndicator extends HealthIndicator {
  constructor(private readonly http: HttpService) {
    super();
  }

  async checkRpc(key: string, rpcUrl: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      if (!rpcUrl) {
        throw new Error('RPC URL not configured');
      }

      const response = await firstValueFrom(
        this.http
          .post(
            rpcUrl,
            {
              jsonrpc: '2.0',
              method: 'eth_blockNumber',
              params: [],
              id: 1,
            },
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
          .pipe(
            timeout(2000), // 2 second timeout
            catchError((error) => {
              throw new Error(`RPC request failed: ${error.message}`);
            }),
          ),
      );

      const responseTime = Date.now() - startTime;
      const blockNumber = parseInt(response.data.result, 16);

      if (!blockNumber || blockNumber === 0) {
        throw new Error('Invalid block number received');
      }

      return this.getStatus(key, true, {
        blockNumber,
        responseTime: `${responseTime}ms`,
        rpcUrl: rpcUrl.replace(/\/\/.*@/, '//***@'), // Mask API keys
      });
    } catch (error) {
      const result = this.getStatus(key, false, {
        message: error.message,
        rpcUrl: rpcUrl.replace(/\/\/.*@/, '//***@'),
      });

      throw new HealthCheckError('EVM RPC check failed', result);
    }
  }
}
