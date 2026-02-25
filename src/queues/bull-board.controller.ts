import { Controller, Get, All, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { QUEUE_NAMES } from './queues.module';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/queues')
@Roles(UserRole.ADMIN)
export class BullBoardController {
  private readonly serverAdapter: ExpressAdapter;

  constructor(
    @InjectQueue(QUEUE_NAMES.TX_VERIFICATION) txVerification: Queue,
    @InjectQueue(QUEUE_NAMES.WALLET_CREATION) walletCreation: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) notifications: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) analytics: Queue,
    @InjectQueue(QUEUE_NAMES.ROOM_EXPIRY) roomExpiry: Queue,
  ) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(txVerification),
        new BullMQAdapter(walletCreation),
        new BullMQAdapter(notifications),
        new BullMQAdapter(analytics),
        new BullMQAdapter(roomExpiry),
      ],
      serverAdapter: this.serverAdapter,
    });
  }

  @Get()
  @ApiOperation({ summary: '[ADMIN] Bull Board dashboard' })
  index(@Req() req: Request, @Res() res: Response) {
    const router = this.serverAdapter.getRouter();
    router(req, res);
  }

  @All('*')
  all(@Req() req: Request, @Res() res: Response) {
    const router = this.serverAdapter.getRouter();
    router(req, res);
  }
}
