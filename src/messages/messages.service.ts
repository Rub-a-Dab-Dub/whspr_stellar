import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
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
import { AnalyticsService } from '../analytics/analytics.service';
import { EventType } from '../analytics/entities/analytics-event.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessagesGateway } from './messages.gateway';
import { UserXpService } from '../xp/user-xp.service';
import { XpReason } from '../xp/entities/xp-transaction.entity';

const MEDIA_RATE_LIMIT_PER_HOUR = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Max XP gainable from messages per hour (rate-limit cap) */
const MESSAGE_XP_CAP_PER_HOUR = 100;
const MESSAGE_XP_AMOUNT = 10;

export interface UploadMediaResult {
  ipfsHash: string;
  gatewayUrl: string;
  contentHash: string;
  mediaType: MediaType;
}

export interface SendMessagePayload {
  roomId: string;
  content?: string;
  type?: MessageType;
  ipfsHash?: string;
  replyToId?: string;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  /**
   * In-memory rolling XP totals per user for the current hour.
   * Key: userId  Value: { xpThisHour, windowStart }
   * Resets automatically once the window is older than ONE_HOUR_MS.
   */
  private readonly xpHourlyTracker = new Map<
    string,
    { xpThisHour: number; windowStart: number }
  >();

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
    private readonly analyticsService: AnalyticsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  // ─── Media upload ─────────────────────────────────────────────────────────

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

  // ─── Persist & broadcast ─────────────────────────────────────────────────

  /**
   * Persist a message to the DB first, then broadcast it.
   * Awards +10 XP (rate-capped at 100 XP/hour from messages).
   */
  async persistAndBroadcast(
    senderId: string,
    payload: SendMessagePayload,
  ): Promise<Message> {
    const {
      roomId,
      content,
      type = MessageType.TEXT,
      ipfsHash,
      replyToId,
    } = payload;

    // Verify room exists and is not expired / archived
    const roomCheck = await this.messageRepository.manager.query(
      `SELECT id, is_expired, is_active FROM rooms WHERE id = $1`,
      [roomId],
    );
    if (!roomCheck || roomCheck.length === 0) {
      throw new NotFoundException('Room not found');
    }
    const room = roomCheck[0];
    if (room.is_expired) {
      throw new ForbiddenException(
        'Room has expired – no new messages allowed',
      );
    }
    if (!room.is_active) {
      throw new ForbiddenException('Room is archived');
    }

    // Persist message BEFORE broadcasting (never lose a message)
    const message = this.messageRepository.create({
      senderId,
      roomId,
      content: content ?? null,
      type,
      ipfsHash: ipfsHash ?? null,
      replyToId: replyToId ?? null,
    });
    const saved = await this.messageRepository.save(message);

    // Broadcast to room
    this.messagesGateway.broadcastMessage(roomId, saved);

    // Emit internal event for room stats
    this.eventEmitter.emit('message.sent', {
      roomId,
      userId: senderId,
    });

    // Analytics
    await this.analyticsService
      .track(senderId, EventType.MESSAGE_SENT, {
        roomId,
        messageId: saved.id,
        type,
      })
      .catch(() => {
        /* non-critical */
      });

    // XP award (rate-capped: max 100 XP/hour from messages)
    this.awardMessageXp(senderId).catch((err) =>
      this.logger.warn(`XP award failed for ${senderId}: ${err.message}`),
    );

    return saved;
  }

  /**
   * Awards +10 XP for sending a message.
   * A rolling in-memory window ensures the user earns ≤ 100 XP/hour
   * from message-send events regardless of concurrency spikes.
   */
  private async awardMessageXp(userId: string): Promise<void> {
    const now = Date.now();
    let tracker = this.xpHourlyTracker.get(userId);

    // Reset window if older than 1 hour
    if (!tracker || now - tracker.windowStart >= ONE_HOUR_MS) {
      tracker = { xpThisHour: 0, windowStart: now };
      this.xpHourlyTracker.set(userId, tracker);
    }

    if (tracker.xpThisHour >= MESSAGE_XP_CAP_PER_HOUR) {
      this.logger.debug(`XP cap reached for ${userId} – skipping award`);
      return;
    }

    const toAward = Math.min(
      MESSAGE_XP_AMOUNT,
      MESSAGE_XP_CAP_PER_HOUR - tracker.xpThisHour,
    );

    tracker.xpThisHour += toAward;
    await this.xpService.award(userId, XpReason.SEND_MESSAGE);
  }

  // ─── Legacy on-chain send ───────────────────────────────────────────────

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

    this.eventEmitter.emit('message.sent', {
      roomId: roomId.toString(),
      userId,
      tipAmount,
    });

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

  // ─── Edit ────────────────────────────────────────────────────────────────

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

    const messageEdit = this.messageEditRepository.create({
      messageId: message.id,
      previousContent: message.content,
      editedById: userId,
    });
    await this.messageEditRepository.save(messageEdit);

    message.content = newContent;
    message.editedAt = new Date();
    await this.messageRepository.save(message);

    this.messagesGateway.emitMessageEdited(
      message.roomId.toString(),
      message.id,
      message.content,
      message.editedAt,
    );

    return { success: true, data: message };
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender'],
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
      const rm = await this.roomMemberRepository.findOne({
        where: { roomId: message.roomId, userId },
        relations: ['room'],
      });

      if (rm) {
        const roomObj = rm.room as any;
        if (roomObj?.creatorId === userId) {
          isAuthorized = true;
        } else if ((rm as any).role === 'MODERATOR') {
          isAuthorized = true;
        }
      } else {
        const creatorCheck = await this.roomMemberRepository.manager.query(
          `SELECT creator_id FROM rooms WHERE id = $1`,
          [message.roomId],
        );
        if (
          creatorCheck &&
          creatorCheck.length > 0 &&
          creatorCheck[0].creator_id === userId
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

    const messageEdit = this.messageEditRepository.create({
      messageId: message.id,
      previousContent: message.content,
      editedById: userId,
    });
    await this.messageEditRepository.save(messageEdit);

    message.isDeleted = true;
    message.content = '[Message deleted]';
    message.deletedAt = new Date();
    message.editedAt = new Date();
    await this.messageRepository.save(message);

    this.messagesGateway.emitMessageDeleted(
      message.roomId.toString(),
      message.id,
    );

    return { success: true };
  }
}
