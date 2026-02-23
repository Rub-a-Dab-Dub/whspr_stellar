import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StellarBlockchainEvent, StellarEventStatus } from './entities/stellar-event.entity';

@Injectable()
export class StellarEventAnalyticsService {
    private readonly logger = new Logger(StellarEventAnalyticsService.name);

    constructor(
        @InjectRepository(StellarBlockchainEvent)
        private eventRepo: Repository<StellarBlockchainEvent>,
    ) { }

    async getEventStats() {
        const totalEvents = await this.eventRepo.count();
        const statusCounts = await this.eventRepo
            .createQueryBuilder('event')
            .select('event.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('event.status')
            .getRawMany();

        const typeCounts = await this.eventRepo
            .createQueryBuilder('event')
            .select('event.eventName', 'name')
            .addSelect('COUNT(*)', 'count')
            .groupBy('event.eventName')
            .getRawMany();

        return {
            totalEvents,
            statusCounts,
            typeCounts,
        };
    }

    async getSyncHealth() {
        // Check for stalled events or large gaps
        const recentFailed = await this.eventRepo.count({
            where: { status: StellarEventStatus.FAILED },
        });

        return {
            isHealthy: recentFailed < 10,
            failedCount: recentFailed,
        };
    }
}
