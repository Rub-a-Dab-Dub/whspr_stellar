import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../queue.constants';

export enum BlockchainTaskType {
  TRANSACTION = 'transaction',
  QUERY = 'query',
  CONTRACT_CALL = 'contract_call',
  BALANCE_CHECK = 'balance_check',
}

@Processor(QUEUE_NAMES.BLOCKCHAIN_TASKS)
export class BlockchainTaskProcessor {
  private readonly logger = new Logger(BlockchainTaskProcessor.name);

  @Process()
  async handleBlockchainTask(job: Job) {
    this.logger.log(`Processing blockchain task job ${job.id}`);
    this.logger.debug(`Job data: ${JSON.stringify(job.data)}`);

    try {
      const { taskType, params } = job.data;

      await job.progress(10);

      let result;
      switch (taskType) {
        case BlockchainTaskType.TRANSACTION:
          result = await this.processTransaction(params, job);
          break;
        case BlockchainTaskType.QUERY:
          result = await this.processQuery(params, job);
          break;
        case BlockchainTaskType.CONTRACT_CALL:
          result = await this.processContractCall(params, job);
          break;
        case BlockchainTaskType.BALANCE_CHECK:
          result = await this.processBalanceCheck(params, job);
          break;
        default:
          throw new Error(`Unknown blockchain task type: ${taskType}`);
      }

      await job.progress(100);
      this.logger.log(`Blockchain task job ${job.id} completed successfully`);

      return {
        success: true,
        taskType,
        result,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Blockchain task job ${job.id} failed:`, error);
      
      // Check if this is a network error that should be retried
      if (this.isRetryableError(error)) {
        this.logger.warn(`Retryable error detected for job ${job.id}`);
        throw error; // This will trigger the retry mechanism
      }
      
      throw error;
    }
  }

  private async processTransaction(params: any, job: Job) {
    this.logger.log(`Processing transaction: ${JSON.stringify(params)}`);
    await job.progress(30);
    
    // TODO: Implement actual blockchain transaction logic
    // Example: Sign transaction, broadcast to network, wait for confirmation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await job.progress(80);
    
    return {
      transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      status: 'confirmed',
    };
  }

  private async processQuery(params: any, job: Job) {
    this.logger.log(`Processing query: ${JSON.stringify(params)}`);
    await job.progress(50);
    
    // TODO: Implement actual blockchain query logic
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    return {
      queryResult: 'Sample query result',
    };
  }

  private async processContractCall(params: any, job: Job) {
    this.logger.log(`Processing contract call: ${JSON.stringify(params)}`);
    await job.progress(40);
    
    // TODO: Implement actual smart contract interaction logic
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    await job.progress(90);
    
    return {
      contractResponse: 'Sample contract response',
    };
  }

  private async processBalanceCheck(params: any, job: Job) {
    this.logger.log(`Processing balance check: ${JSON.stringify(params)}`);
    await job.progress(60);
    
    // TODO: Implement actual balance check logic
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    return {
      address: params.address,
      balance: '1000000000000000000', // 1 token in wei
    };
  }

  private isRetryableError(error: any): boolean {
    // Define which errors should trigger a retry
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'CONNECTION_REFUSED',
      'ECONNREFUSED',
    ];

    return retryableErrors.some((errType) =>
      error.message?.includes(errType) || error.code === errType,
    );
  }
}
