import { Controller, Get, Post, Body, Param, UseInterceptors } from '@nestjs/common';
import { HttpCacheInterceptor } from '../cache/interceptors/cache.interceptor';
import { CacheKey, CacheTTL } from '../cache/decorators/cache-key.decorator';
import { QueueService } from '../queue/queue.service';
import { CacheService } from '../cache/cache.service';

@Controller('test')
export class TestController {
  constructor(
    private readonly queueService: QueueService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Test endpoint with cache interceptor
   * This endpoint will cache responses for 60 seconds
   */
  @Get('cached-data')
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(60)
  async getCachedData() {
    // Simulate expensive operation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    return {
      message: 'This response is cached for 60 seconds',
      timestamp: new Date().toISOString(),
      data: {
        random: Math.random(),
        cached: true,
      },
    };
  }

  /**
   * Test endpoint to add a wallet creation job to the queue
   */
  @Post('queue/wallet')
  async createWalletJob(@Body() data: { userId: string; walletType: string }) {
    const job = await this.queueService.addWalletCreationJob(data);
    
    return {
      message: 'Wallet creation job added to queue',
      jobId: job.id,
      data: job.data,
    };
  }

  /**
   * Test endpoint to add a notification job to the queue
   */
  @Post('queue/notification')
  async createNotificationJob(
    @Body() data: { type: string; recipient: string; message: string },
  ) {
    const job = await this.queueService.addNotificationJob(data);
    
    return {
      message: 'Notification job added to queue',
      jobId: job.id,
      data: job.data,
    };
  }

  /**
   * Test endpoint to add a blockchain task job to the queue
   */
  @Post('queue/blockchain')
  async createBlockchainJob(
    @Body() data: { taskType: string; params: any },
  ) {
    const job = await this.queueService.addBlockchainTaskJob(data);
    
    return {
      message: 'Blockchain task job added to queue',
      jobId: job.id,
      data: job.data,
    };
  }

  /**
   * Test endpoint to get job status
   */
  @Get('queue/job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.queueService.getJobStatus(jobId);
    
    if (!status) {
      return {
        message: 'Job not found',
        jobId,
      };
    }
    
    return {
      message: 'Job status retrieved',
      ...status,
    };
  }

  /**
   * Test endpoint to manually set cache
   */
  @Post('cache/set')
  async setCache(@Body() data: { key: string; value: any; ttl?: number }) {
    await this.cacheService.set(data.key, data.value, data.ttl);
    
    return {
      message: 'Cache set successfully',
      key: data.key,
      ttl: data.ttl || 'default',
    };
  }

  /**
   * Test endpoint to manually get cache
   */
  @Get('cache/get/:key')
  async getCache(@Param('key') key: string) {
    const value = await this.cacheService.get(key);
    
    return {
      message: value ? 'Cache hit' : 'Cache miss',
      key,
      value,
    };
  }
}
