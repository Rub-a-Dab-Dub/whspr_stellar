import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { Message, MessageType } from '../messages/entities/message.entity';
import { Transaction, TransactionStatus } from '../transactions/entities/transaction.entity';
import {
  InChatTransfer,
  TransferCommandType,
  TransferStatus,
} from './entities/in-chat-transfer.entity';
import { UsersRepository } from '../users/users.repository';
import { Wallet } from '../wallets/entities/wallet.entity';
import { SavedAddressesService } from '../address-book/saved-addresses.service';
import { InitiateTransferDto } from './dto/initiate-transfer.dto';
import { TransferPreviewDto } from './dto/transfer-preview.dto';
import { TransferResponseDto } from './dto/transfer-response.dto';
import { SorobanTransfersService } from './soroban-transfers.service';

interface ParsedTransferCommand {
  commandType: TransferCommandType;
  mentionedUsernames: string[];
  totalAmount: string;
  asset: string;
}

interface ResolvedTransferCommand {
  commandType: TransferCommandType;
  recipientUsers: Array<{ id: string; username: string; walletAddress: string }>;
  totalAmount: string;
  amountPerRecipient: string;
  asset: string;
}

const STROOPS_FACTOR = 10_000_000;

@Injectable()
export class InChatTransfersService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantsRepository: Repository<ConversationParticipant>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    @InjectRepository(InChatTransfer)
    private readonly transfersRepository: Repository<InChatTransfer>,
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    private readonly usersRepository: UsersRepository,
    private readonly sorobanTransfersService: SorobanTransfersService,
    private readonly savedAddressesService: SavedAddressesService,
  ) {}

  parseTransferCommand(raw: string): ParsedTransferCommand {
    const trimmed = raw.trim();
    const sendMatch = trimmed.match(
      /^\/send\s+((?:@[A-Za-z0-9_]+\s*)+)\s+([0-9]+(?:\.[0-9]{1,7})?)\s+([A-Za-z0-9]{2,12})$/i,
    );
    if (sendMatch) {
      return {
        commandType: TransferCommandType.SEND,
        mentionedUsernames: this.extractMentions(sendMatch[1]),
        totalAmount: this.normalizeAmount(sendMatch[2]),
        asset: sendMatch[3].toUpperCase(),
      };
    }

    const tipWithMentionMatch = trimmed.match(
      /^\/tip\s+((?:@[A-Za-z0-9_]+\s*)+)\s+([0-9]+(?:\.[0-9]{1,7})?)\s+([A-Za-z0-9]{2,12})$/i,
    );
    if (tipWithMentionMatch) {
      return {
        commandType: TransferCommandType.TIP,
        mentionedUsernames: this.extractMentions(tipWithMentionMatch[1]),
        totalAmount: this.normalizeAmount(tipWithMentionMatch[2]),
        asset: tipWithMentionMatch[3].toUpperCase(),
      };
    }

    const tipMatch = trimmed.match(/^\/tip\s+([0-9]+(?:\.[0-9]{1,7})?)\s+([A-Za-z0-9]{2,12})$/i);
    if (tipMatch) {
      return {
        commandType: TransferCommandType.TIP,
        mentionedUsernames: [],
        totalAmount: this.normalizeAmount(tipMatch[1]),
        asset: tipMatch[2].toUpperCase(),
      };
    }

    const splitMatch = trimmed.match(
      /^\/split\s+([0-9]+(?:\.[0-9]{1,7})?)\s+([A-Za-z0-9]{2,12})\s+((?:@[A-Za-z0-9_]+\s*)+)$/i,
    );
    if (splitMatch) {
      return {
        commandType: TransferCommandType.SPLIT,
        mentionedUsernames: this.extractMentions(splitMatch[3]),
        totalAmount: this.normalizeAmount(splitMatch[1]),
        asset: splitMatch[2].toUpperCase(),
      };
    }

    throw new BadRequestException(
      'Invalid transfer command. Use /send @user 10 XLM, /tip 5 USDC, or /split 30 XLM @a @b @c.',
    );
  }

  async estimateFee(asset: string, amount: string, recipientCount = 1): Promise<string> {
    return this.sorobanTransfersService.estimateFee(asset, amount, recipientCount);
  }

  async getTransferPreview(
    senderId: string,
    conversationId: string,
    rawCommand: string,
  ): Promise<TransferPreviewDto> {
    const conversation = await this.getConversationOrThrow(conversationId);
    const participants = await this.getConversationParticipants(conversationId);
    this.assertParticipant(participants, senderId);

    const resolved = await this.resolveCommand(senderId, participants, rawCommand);
    const feeEstimate = await this.estimateFee(
      resolved.asset,
      resolved.totalAmount,
      resolved.recipientUsers.length,
    );

    const transfer = await this.transfersRepository.save(
      this.transfersRepository.create({
        conversationId: conversation.id,
        senderId,
        recipientIds: resolved.recipientUsers.map((user) => user.id),
        recipientUsernames: resolved.recipientUsers.map((user) => user.username),
        commandType: resolved.commandType,
        rawCommand,
        totalAmount: resolved.totalAmount,
        amountPerRecipient: resolved.amountPerRecipient,
        asset: resolved.asset,
        feeEstimate,
        status: TransferStatus.PENDING_CONFIRMATION,
      }),
    );

    return this.toPreviewDto(transfer);
  }

  async initiateTransfer(
    senderId: string,
    conversationId: string,
    dto: InitiateTransferDto,
  ): Promise<TransferPreviewDto> {
    return this.getTransferPreview(senderId, conversationId, dto.rawCommand);
  }

  async confirmTransfer(transferId: string, senderId: string): Promise<TransferResponseDto> {
    const transfer = await this.transfersRepository.findOne({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found.');
    }

    if (transfer.senderId !== senderId) {
      throw new BadRequestException('Only the transfer sender can confirm this transfer.');
    }

    if (transfer.status !== TransferStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException('Transfer preview must be created before confirmation.');
    }

    transfer.status = TransferStatus.CONFIRMED;
    await this.transfersRepository.save(transfer);

    const senderAddress = await this.resolveSenderAddress(senderId);
    const recipientUsers = await this.usersRepository.find({
      where: { id: In(transfer.recipientIds) },
      order: { createdAt: 'ASC' },
    });

    const transaction = await this.transactionsRepository.save(
      this.transactionsRepository.create({
        senderId,
        asset: transfer.asset,
        totalAmount: transfer.totalAmount,
        status: TransactionStatus.SUBMITTED,
      }),
    );

    transfer.transactionId = transaction.id;
    transfer.status = TransferStatus.SUBMITTED;
    await this.transfersRepository.save(transfer);

    try {
      const txHash = await this.sorobanTransfersService.submitTransfer(
        {
          senderAddress,
          recipientAddresses: recipientUsers.map((user) => user.walletAddress),
          asset: transfer.asset,
          amountPerRecipient: transfer.amountPerRecipient,
          totalAmount: transfer.totalAmount,
        },
        { userId: senderId },
      );

      transaction.status = TransactionStatus.COMPLETED;
      transaction.txHash = txHash;
      await this.transactionsRepository.save(transaction);

      const message = await this.messagesRepository.save(
        this.messagesRepository.create({
          conversationId: transfer.conversationId,
          senderId,
          type: MessageType.TRANSFER,
          content: this.buildSuccessMessage(
            transfer.amountPerRecipient,
            transfer.asset,
            transfer.recipientUsernames
              .filter((username): username is string => Boolean(username))
              .sort((left, right) => left.localeCompare(right)),
            transfer.commandType,
            transfer.totalAmount,
          ),
        }),
      );

      transfer.status = TransferStatus.COMPLETED;
      transfer.sorobanTxHash = txHash;
      transfer.messageId = message.id;
      transfer.transactionId = transaction.id;
      await this.transfersRepository.save(transfer);

      await Promise.all(
        recipientUsers.map((recipient) =>
          this.savedAddressesService.trackUsageByWalletAddress(senderId, recipient.walletAddress),
        ),
      );

      return {
        transferId: transfer.id,
        conversationId: transfer.conversationId,
        status: transfer.status,
        sorobanTxHash: txHash,
        messageId: message.id,
        message: 'Transfer completed.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transfer submission failed.';

      transaction.status = TransactionStatus.FAILED;
      transaction.errorMessage = errorMessage;
      await this.transactionsRepository.save(transaction);

      const message = await this.messagesRepository.save(
        this.messagesRepository.create({
          conversationId: transfer.conversationId,
          senderId,
          type: MessageType.SYSTEM,
          content: `Transfer failed: ${errorMessage}`,
        }),
      );

      transfer.status = TransferStatus.FAILED;
      transfer.errorMessage = errorMessage;
      transfer.messageId = message.id;
      transfer.transactionId = transaction.id;
      await this.transfersRepository.save(transfer);

      return {
        transferId: transfer.id,
        conversationId: transfer.conversationId,
        status: transfer.status,
        errorMessage,
        messageId: message.id,
        message: 'Transfer failed.',
      };
    }
  }

  async listConversationTransfers(conversationId: string): Promise<InChatTransfer[]> {
    await this.getConversationOrThrow(conversationId);

    return this.transfersRepository.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });
  }

  private async getConversationOrThrow(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    return conversation;
  }

  private async getConversationParticipants(
    conversationId: string,
  ): Promise<ConversationParticipant[]> {
    return this.participantsRepository.find({
      where: { conversationId },
      relations: ['user'],
    });
  }

  private assertParticipant(participants: ConversationParticipant[], userId: string): void {
    if (!participants.some((participant) => participant.userId === userId)) {
      throw new BadRequestException('User is not a participant in this conversation.');
    }
  }

  private async resolveCommand(
    senderId: string,
    participants: ConversationParticipant[],
    rawCommand: string,
  ): Promise<ResolvedTransferCommand> {
    const parsed = this.parseTransferCommand(rawCommand);
    const recipientUsers = await this.resolveRecipients(senderId, participants, parsed);
    const amountPerRecipient =
      parsed.commandType === TransferCommandType.SPLIT
        ? this.divideAmount(parsed.totalAmount, recipientUsers.length)
        : parsed.totalAmount;

    return {
      commandType: parsed.commandType,
      recipientUsers,
      totalAmount: parsed.totalAmount,
      amountPerRecipient,
      asset: parsed.asset,
    };
  }

  private async resolveRecipients(
    senderId: string,
    participants: ConversationParticipant[],
    parsed: ParsedTransferCommand,
  ): Promise<Array<{ id: string; username: string; walletAddress: string }>> {
    const participantUsers = participants
      .filter((participant) => participant.userId !== senderId)
      .map((participant) => participant.user)
      .filter((user): user is NonNullable<typeof user> => Boolean(user));

    let usernames = parsed.mentionedUsernames;
    if (parsed.commandType === TransferCommandType.TIP && usernames.length === 0) {
      if (participantUsers.length !== 1) {
        throw new BadRequestException(
          'Tip commands without a mention only work in a direct conversation.',
        );
      }

      usernames = [participantUsers[0].username ?? ''];
    }

    if (usernames.length === 0) {
      throw new BadRequestException('At least one recipient must be provided.');
    }

    const uniqueUsernames = [...new Set(usernames.map((username) => username.toLowerCase()))];
    const matchedParticipants = participantUsers.filter(
      (user) => user.username && uniqueUsernames.includes(user.username.toLowerCase()),
    );

    if (matchedParticipants.length !== uniqueUsernames.length) {
      throw new BadRequestException(
        'All transfer recipients must be users in the target conversation.',
      );
    }

    return matchedParticipants.map((user) => ({
      id: user.id,
      username: user.username!,
      walletAddress: user.walletAddress,
    }));
  }

  private async resolveSenderAddress(senderId: string): Promise<string> {
    const wallet = await this.walletsRepository.findOne({
      where: { userId: senderId, isPrimary: true },
      order: { createdAt: 'ASC' },
    });

    if (wallet) {
      return wallet.walletAddress;
    }

    const user = await this.usersRepository.findOne({ where: { id: senderId } });
    if (!user) {
      throw new NotFoundException('Sender not found.');
    }

    return user.walletAddress;
  }

  private toPreviewDto(transfer: InChatTransfer): TransferPreviewDto {
    const recipientCount = transfer.recipientIds.length;
    const totalCost =
      transfer.commandType === TransferCommandType.SPLIT
        ? this.addAmounts(transfer.totalAmount, transfer.feeEstimate)
        : this.addAmounts(
            this.multiplyAmount(transfer.amountPerRecipient, recipientCount),
            transfer.feeEstimate,
          );

    return {
      transferId: transfer.id,
      conversationId: transfer.conversationId,
      senderId: transfer.senderId,
      recipients: transfer.recipientUsernames,
      asset: transfer.asset,
      totalAmount: transfer.totalAmount,
      amountPerRecipient: transfer.amountPerRecipient,
      feeEstimate: transfer.feeEstimate,
      totalCost,
      status: transfer.status,
    };
  }

  private buildSuccessMessage(
    amountPerRecipient: string,
    asset: string,
    recipients: string[],
    commandType: TransferCommandType,
    totalAmount: string,
  ): string {
    if (commandType === TransferCommandType.SPLIT) {
      return `Split ${totalAmount} ${asset} across ${recipients.map((name) => `@${name}`).join(', ')} (${amountPerRecipient} ${asset} each).`;
    }

    if (recipients.length === 1) {
      return `Sent ${amountPerRecipient} ${asset} to @${recipients[0]}.`;
    }

    return `Sent ${amountPerRecipient} ${asset} each to ${recipients.map((name) => `@${name}`).join(', ')}.`;
  }

  private extractMentions(value: string): string[] {
    return (value.match(/@[A-Za-z0-9_]+/g) ?? []).map((mention) => mention.slice(1));
  }

  private normalizeAmount(value: string): string {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      throw new BadRequestException('Transfer amount must be greater than zero.');
    }

    return normalized.toFixed(7);
  }

  private divideAmount(totalAmount: string, count: number): string {
    return this.fromStroops(this.toStroops(totalAmount) / BigInt(count));
  }

  private multiplyAmount(amount: string, multiplier: number): string {
    return this.fromStroops(this.toStroops(amount) * BigInt(multiplier));
  }

  private addAmounts(left: string, right: string): string {
    return this.fromStroops(this.toStroops(left) + this.toStroops(right));
  }

  private toStroops(amount: string): bigint {
    return BigInt(Math.round(Number(amount) * STROOPS_FACTOR));
  }

  private fromStroops(value: bigint): string {
    return (Number(value) / STROOPS_FACTOR).toFixed(7);
  }
}
