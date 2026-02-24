import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan } from 'typeorm';
import { XpBoostEvent } from '../entities/xp-boost-event.entity';
import { XpBoostService } from '../services/xp-boost.service';

@Injectable()
export class XpBoostCronJob {
  private readonly logger = new Logger(XpBoostCronJob.name);

  constructor(
    @InjectRepository(XpBoostEvent)
    private readonly xpBoostEventRepository: Repository<XpBoostEvent>,
    private readonly xpBoostService: XpBoostService,
  ) {}

  @Cron('*/1 * * * *')
  async handleXpBoostEvents(): Promise<void> {
    try {
      const now = new Date();

      const eventsToActivate = await this.xpBoostEventRepository.find({
        where: {
          isActive: false,
          startAt: LessThanOrEqual(now),
          endAt: MoreThan(now),
        },
      });

      for (const event of eventsToActivate) {
        await this.xpBoostService.activateEvent(event);
      }

      const eventsToDeactivate = await this.xpBoostEventRepository.find({
        where: {
          isActive: true,
          endAt: LessThanOrEqual(now),
        },
      });

      for (const event of eventsToDeactivate) {
        await this.xpBoostService.deactivateEvent(event);
      }
    } catch (error) {
      this.logger.error('Error in XP boost event cron job:', error);
    }
  }
}
