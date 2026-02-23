import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IStellarEventHandler } from '../interfaces/event-handler.interface';
import { StellarBlockchainEvent } from '../entities/stellar-event.entity';
import { User } from '../../../user/entities/user.entity';

@Injectable()
export class UserRegistrationHandler implements IStellarEventHandler {
    private readonly logger = new Logger(UserRegistrationHandler.name);

    constructor(
        @InjectRepository(User)
        private userRepo: Repository<User>,
    ) { }

    async handle(event: StellarBlockchainEvent): Promise<void> {
        const { eventName, topics, eventData } = event;

        if (eventName === 'user_registered') {
            await this.handleRegistration(topics, eventData);
        } else if (eventName === 'username_updated') {
            await this.handleUsernameUpdate(topics, eventData);
        }
    }

    private async handleRegistration(topics: any[], data: any) {
        // topics = [eventName, userAddress]
        // data = [username, timestamp]
        const walletAddress = topics[1];
        const username = data[0];

        this.logger.log(`Handling user registration for ${username} (${walletAddress})`);

        let user = await this.userRepo.findOne({ where: { walletAddress } });
        if (!user) {
            user = this.userRepo.create({
                walletAddress,
                username,
                isVerified: true,
                verifiedAt: new Date(),
            });
        } else {
            user.username = username;
        }

        await this.userRepo.save(user);
        this.logger.log(`User ${username} sync completed`);
    }

    private async handleUsernameUpdate(topics: any[], data: any) {
        // topics = [eventName, userAddress]
        // data = [old_username, new_username]
        const walletAddress = topics[1];
        const newUsername = data[1];

        this.logger.log(`Handling username update for ${walletAddress} to ${newUsername}`);

        const user = await this.userRepo.findOne({ where: { walletAddress } });
        if (user) {
            user.username = newUsername;
            await this.userRepo.save(user);
            this.logger.log(`Username updated for ${walletAddress}`);
        } else {
            this.logger.warn(`User with wallet ${walletAddress} not found for username update`);
        }
    }
}
