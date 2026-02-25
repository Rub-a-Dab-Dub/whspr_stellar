import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { MessageMedia, MediaType } from './entities/message-media.entity';
import { Message, MessageType } from './entities/message.entity';
import { MessageEdit } from './entities/message-edit.entity';
import { User } from '../user/entities/user.entity';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { IpfsService } from './services/ipfs.service';
import {
  IMediaScanService,
  MEDIA_SCAN_SERVICE,
} from './services/media-scan.service';
import { ContractMessageService } from './services/contract-message.service';
import { MessagesGateway } from './messages.gateway';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

const MEDIA_RATE_LIMIT_PER_HOUR = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;

export interface UploadMediaResult {
  ipfsHash: string;
  gatewayUrl: string;
  contentHash: string;
  mediaType: MediaType;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(MessageMedia)
    private readonly messageMediaRepository: Repository<MessageMedia>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageEdit)
    private readonly messageEditRepository: Repository<MessageEdit>,
    @InjectRepository(RoomMember)
    private readonly roomMemberRepository: Repository<RoomMember>,
    private readonly ipfsService: IpfsService,
    @Inject(MEDIA_SCAN_SERVICE)
    private readonly mediaScanService: IMediaScanService,
    private readonly contractMessageService: ContractMessageService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  async uploadMedia(
    userId: string,
    buffer: Buffer,
    mediaType: string,
  ): Promise<UploadMediaResult> {
    if (!IpfsService.isAllowedMediaType(mediaType)) {
      throw new BadRequestException(
        `Unsupported media type. Allowed: image/jpeg, image/png, image/gif, video/mp4`,
      );
    }

    const maxBytes = IpfsService.getMaxBytesForMediaType(mediaType);
    if (buffer.length > maxBytes) {
      const limitMB = maxBytes / (1024 * 1024);
      throw new BadRequestException(
        `File too large. Max ${limitMB}MB for ${mediaType}`,
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'walletAddress'],
    });
    if (!user?.walletAddress) {
      throw new BadRequestException('User has no wallet address linked');
    }

    const count = await this.messageMediaRepository.count({
      where: {
        walletAddress: user.walletAddress,
        createdAt: MoreThan(new Date(Date.now() - ONE_HOUR_MS)),
      },
    });
    if (count >= MEDIA_RATE_LIMIT_PER_HOUR) {
      throw new BadRequestException(
        `Rate limit exceeded. Max ${MEDIA_RATE_LIMIT_PER_HOUR} media uploads per hour.`,
      );
    }

    const scanResult = await this.mediaScanService.scan(buffer, mediaType);
    if (!scanResult.safe) {
      throw new BadRequestException(
        scanResult.reason ?? 'Media content rejected by scan',
      );
    }

    const { cid, path } = await this.ipfsService.add(buffer);
    const contentHash = this.ipfsService.contentHashFromCid(cid);
    const gatewayUrl = this.ipfsService.gatewayUrlForCid(cid);

    const record = this.messageMediaRepository.create({
      walletAddress: user.walletAddress,
      ipfsCid: path,
      contentHash,
      mediaType: mediaType as MediaType,
      gatewayUrl,
    });
    await this.messageMediaRepository.save(record);

    return {
      ipfsHash: path,
      gatewayUrl,
      contentHash,
      mediaType: mediaType as MediaType,
    };
  }

  async sendMessage(
    userId: string,
    roomId: bigint,
    contentHash: string,
    tipAmount: bigint = BigInt(0),
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'walletAddress'],
    });
    if (!user?.walletAddress) {
      throw new BadRequestException('User has no wallet address linked');
    }

    const result = await this.contractMessageService.sendMessage(
      user.walletAddress,
      roomId,
      contentHash,
      tipAmount,
    );

    // Emit event for room stats
    this.eventEmitter.emit('message.sent', {
      roomId: roomId.toString(),
      userId,
      tipAmount,
    });

    // Track analytics
    await this.analyticsService.track(userId, EventType.MESSAGE_SENT, {
      roomId: roomId.toString(),
      contentHash,
      hasTip: tipAmount > BigInt(0),
    });

    if (tipAmount > BigInt(0)) {
      await this.analyticsService.track(userId, EventType.TIP_SENT, {
        roomId: roomId.toString(),
        amount: tipAmount.toString(),
      });
    }

    return result;
  }

  async editMessage(userId: string, messageId: string, newContent: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.isDeleted) {
      throw new ForbiddenException('Cannot edit a deleted message');
    }

    if (
      message.type === MessageType.SYSTEM ||
      message.type === MessageType.TIP
    ) {
      throw new ForbiddenException('Cannot edit SYSTEM or TIP messages');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const editWindowMs = 15 * 60 * 1000; // 15 minutes
    if (Date.now() - message.createdAt.getTime() > editWindowMs) {
      throw new ForbiddenException(
        'Messages can only be edited within 15 minutes of sending',
      );
    }

    // Preserve previous content in audit table
    const messageEdit = this.messageEditRepository.create({
      messageId: message.id,
      previousContent: message.content,
      editedById: userId,
    });
    await this.messageEditRepository.save(messageEdit);

    // Update message
    message.content = newContent;
    message.editedAt = new Date();
    await this.messageRepository.save(message);

    // Broadcast edit
    this.messagesGateway.emitMessageEdited(
      message.roomId.toString(),
      message.id,
      message.content,
      message.editedAt,
    );

    return { success: true, data: message };
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender'], // may need if relying on sender checks
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.isDeleted) {
      throw new ConflictException('Message already deleted');
    }

    let isAuthorized = false;

    if (message.senderId === userId) {
      isAuthorized = true;
    } else {
      // Check if user is moderator or creator
      const rm = await this.roomMemberRepository.findOne({
        where: { roomId: message.roomId, userId },
        relations: ['room'],
      });

      if (rm) {
        // user is the creator or a moderator
        const roomObj = rm.room as any; // The entity isn't fully typed for nested 'room' here due to 'unknown' in RoomMember, safely cast
        if (roomObj?.creatorId === userId) {
          isAuthorized = true;
        } else if ((rm as any).role === 'MODERATOR') {
          isAuthorized = true;
        }
      } else {
        // Check Room explicitly if rm is missing but they are creator
        const rmCreatorCheck = await this.roomMemberRepository.manager.query(
          `SELECT creator_id FROM rooms WHERE id = $1`,
          [message.roomId],
        );
        if (
          rmCreatorCheck &&
          rmCreatorCheck.length > 0 &&
          rmCreatorCheck[0].creator_id === userId
        ) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Only the sender or a room moderator/creator can delete this message',
      );
    }

    // Save delete state as an edit trail
    const messageEdit = this.messageEditRepository.create({
      messageId: message.id,
      previousContent: message.content,
      editedById: userId,
    });
    await this.messageEditRepository.save(messageEdit);

    // Soft delete / placeholder
    message.isDeleted = true;
    message.content = '[Message deleted]';
    message.editedAt = new Date(); // To satisfy "editedAt timestamp updated on edit" potentially
    await this.messageRepository.save(message);

    // Broadcast delete event
    this.messagesGateway.emitMessageDeleted(
      message.roomId.toString(),
      message.id,
    );

    return { success: true };
  }
}
