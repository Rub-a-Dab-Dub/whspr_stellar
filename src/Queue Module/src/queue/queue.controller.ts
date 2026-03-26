import { Controller, Get, Param } from '@nestjs/common';
import { QueueService } from './queue.service';

@Controller('queues')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('status/:queueName/:id')
  async getStatus(@Param('queueName') queueName: string, @Param('id') id: string) {
    // Minimal status: in real implementation map queueName to actual InjectQueue and call getJob
    return { queue: queueName, id, status: 'unknown' };
  }
}
