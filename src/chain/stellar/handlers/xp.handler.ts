import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IStellarEventHandler } from '../interfaces/event-handler.interface';
import { StellarBlockchainEvent } from '../entities/stellar-event.entity';
import { User } from '../../../user/entities/user.entity';

@Injectable()
export class XPHandler implements IStellarEventHandler {
    private readonly logger = new Logger(XPHandler.name);

    constructor(
        @InjectRepository(User)
        private userRepo: Repository<User>,
    ) { }

    async handle(event: StellarBlockchainEvent): Promise<void> {
        const { eventName, topics, eventData } = event;

        if (eventName === 'xp_changed') {
            await this.handleXpChanged(topics, eventData);
        } else if (eventName === 'level_up') {
            await this.handleLevelUp(topics, eventData);
        }
    }

    private async handleXpChanged(topics: any[], data: any) {
        // topics: [eventName, userAddress]
        // data: [oldXp, newXp, amount]
        const walletAddress = topics[1];
        const newXp = Number(data[1]); // Ensure Number for XP

        this.logger.log(`User ${walletAddress} XP changed to ${newXp}`);

        const user = await this.userRepo.findOne({ where: { walletAddress } });
        if (user) {
            user.currentXp = newXp;
            await this.userRepo.save(user);
            this.logger.log(`XP updated for user ${walletAddress}`);
        } else {
            this.logger.warn(`User with wallet ${walletAddress} not found for XP update`);
        }
    }

    private async handleLevelUp(topics: any[], data: any) {
        // topics: [eventName, userAddress]
        // data: [oldLevel, newLevel]
        const walletAddress = topics[1];
        const newLevel = Number(data[1]); // Ensure Number for Level

        this.logger.log(`User ${walletAddress} leveled up to ${newLevel}`);

        const user = await this.userRepo.findOne({ where: { walletAddress } });
        if (user) {
            user.level = newLevel;
            await this.userRepo.save(user);
            this.logger.log(`Level updated for user ${walletAddress}`);
        } else {
            this.logger.warn(`User with wallet ${walletAddress} not found for Level update`);
        }
    }
}
