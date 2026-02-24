import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IStellarEventHandler } from '../interfaces/event-handler.interface';
import { StellarBlockchainEvent } from '../entities/stellar-event.entity';
import { Transfer, TransferStatus, TransferType } from '../../../transfer/entities/transfer.entity';
import { User } from '../../../user/entities/user.entity';

@Injectable()
export class TransferHandler implements IStellarEventHandler {
    private readonly logger = new Logger(TransferHandler.name);

    constructor(
        @InjectRepository(Transfer)
        private transferRepo: Repository<Transfer>,
        @InjectRepository(User)
        private userRepo: Repository<User>,
    ) { }

    async handle(event: StellarBlockchainEvent): Promise<void> {
        const { eventName, topics, eventData } = event;

        if (eventName === 'transfer') {
            await this.handleTransfer(topics, eventData, event);
        } else if (eventName === 'tip') {
            await this.handleTip(topics, eventData, event);
        }
    }

    private async handleTransfer(topics: any[], data: any, event: StellarBlockchainEvent) {
        // topics: [eventName, sender, recipient]
        // data: [token, amount]
        const senderAddress = topics[1];
        const recipientAddress = topics[2];
        const amount = String(data[1]);

        this.logger.log(`Transfer: ${senderAddress} -> ${recipientAddress}, ${amount}`);

        const sender = await this.userRepo.findOne({ where: { walletAddress: senderAddress } });
        const recipient = await this.userRepo.findOne({ where: { walletAddress: recipientAddress } });

        if (sender && recipient) {
            const transfer = this.transferRepo.create({
                sender,
                recipient,
                amount,
                blockchainNetwork: 'stellar',
                transactionHash: event.transactionHash,
                status: TransferStatus.COMPLETED,
                type: TransferType.P2P,
                completedAt: new Date(),
            });
            await this.transferRepo.save(transfer);
        } else {
            this.logger.warn(`Users not found for transfer: ${senderAddress} or ${recipientAddress}`);
        }
    }

    private async handleTip(topics: any[], data: any, event: StellarBlockchainEvent) {
        // topics: [eventName]
        // data: [tip_id, sender, receiver, amount, fee, message_id]
        const [tipId, senderAddress, receiverAddress, amount, fee, messageId] = data;

        this.logger.log(`Tip ${tipId}: ${senderAddress} -> ${receiverAddress}, ${amount}`);

        const sender = await this.userRepo.findOne({ where: { walletAddress: senderAddress } });
        const receiver = await this.userRepo.findOne({ where: { walletAddress: receiverAddress } });

        if (sender && receiver) {
            const transfer = this.transferRepo.create({
                sender,
                recipient: receiver,
                amount: String(amount),
                blockchainNetwork: 'stellar',
                transactionHash: event.transactionHash,
                status: TransferStatus.COMPLETED,
                type: TransferType.P2P,
                memo: `Tip ID: ${tipId}`,
                completedAt: new Date(),
            });
            await this.transferRepo.save(transfer);

            // Update sender's totalTips? The User entity has totalTips (line 77)
            sender.totalTips = (sender.totalTips || 0) + Number(amount);
            await this.userRepo.save(sender);
        } else {
            this.logger.warn(`Users not found for tip: ${senderAddress} or ${receiverAddress}`);
        }
    }
}
