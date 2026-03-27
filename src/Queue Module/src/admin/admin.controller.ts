import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { Request, Response } from 'express';
import { QueueService } from '../queue/queue.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly queueService: QueueService) {}

  @Get('queues')
  async getBullBoard(@Req() req: Request, @Res() res: Response) {
    // Admin-only endpoint: in this minimal example we skip auth; in production add guards
    const serverAdapter = new ExpressAdapter();
    const { addQueue, setQueues, replaceQueues } = createBullBoard({
      queues: [],
      serverAdapter,
    });
    serverAdapter.setBasePath('/admin/queues');
    // We can't access bull-board's queue adapters directly from Nest's InjectQueue in this simple example.
    // So we return a stub page explaining how to configure when running.
    res.send('<html><body><h1>BullBoard placeholder</h1><p>Open BullBoard configured in app bootstrap in production.</p></body></html>');
  }
}
