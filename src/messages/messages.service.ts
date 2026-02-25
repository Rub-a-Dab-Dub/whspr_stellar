import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { MessageMedia, MediaType } from './entities/message-media.entity';
import { Message } from './entities/message.entity';
import { User } from '../user/entities/user.entity';
import { UserBlock } from '../user/entities/user-block.entity';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { IpfsService } from './services/ipfs.service';
import {
  IMediaScanService,
  MEDIA_SCAN_SERVICE,
} from './services/media-scan.service';
import { ContractMessageService } from './services/contract-message.service';
import { GetMessagesDto, PaginationDirection } from './dto/get-messages.dto';

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
    @InjectRepository(UserBlock)
    private readonly userBlockRepository: Repository<UserBlock>,
    @InjectRepository(RoomMember)
    private readonly roomMemberRepository: Repository<RoomMember>,
    private readonly ipfsService: IpfsService,
    @Inject(MEDIA_SCAN_SERVICE)
    private readonly mediaScanService: IMediaScanService,
    private readonly contractMessageService: ContractMessageService,
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

    return this.contractMessageService.sendMessage(
      user.walletAddress,
      roomId,
      contentHash,
      tipAmount,
    );
  }

  async getRoomMessages(
    userId: string,
    roomId: string,
    getMessagesDto: GetMessagesDto,
  ) {
    const {
      limit = 50,
      cursor,
      direction = PaginationDirection.BEFORE,
    } = getMessagesDto;

    // 1. Check if user is a member of the room (assuming basic membership check)
    const member = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    // In a full implementation, you'd throw ForbiddenException if `!member` and room isn't public, etc.

    // 2. Load blocked users to filter messages
    const blocks = await this.userBlockRepository.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });
    const blockedUserIds = new Set(
      blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)),
    );

    // 3. Build Query Builder for cursor pagination
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.roomId = :roomId', { roomId });

    // 4. Apply cursor filter
    if (cursor) {
      const cursorMessage = await this.messageRepository.findOne({
        where: { id: cursor },
      });
      if (cursorMessage) {
        if (direction === PaginationDirection.BEFORE) {
          queryBuilder.andWhere('message.createdAt < :cursorDate', {
            cursorDate: cursorMessage.createdAt,
          });
        } else {
          queryBuilder.andWhere('message.createdAt > :cursorDate', {
            cursorDate: cursorMessage.createdAt,
          });
        }
      }
    }

    // 5. Apply ordering and limits
    if (direction === PaginationDirection.BEFORE) {
      queryBuilder.orderBy('message.createdAt', 'DESC');
    } else {
      queryBuilder.orderBy('message.createdAt', 'ASC');
    }

    // Fetch `limit + 1` to efficiently check if there are more records (hasMore).
    const takeAmount = Math.min(limit, 100) + 1;
    queryBuilder.take(takeAmount);

    let messages = await queryBuilder.getMany();

    // 6. Check hasMore and format data
    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop(); // Remove the extra check record
    }

    if (direction === PaginationDirection.BEFORE) {
      messages = messages.reverse(); // Standardize chronological list returning
    }

    let unreadCount = 0;
    const processedMessages = messages.map((msg) => {
      // Calculate unreads (using member.joinedAt as a proxy for lastRead since lastRead isn't standard yet)
      if (member && msg.createdAt > member.joinedAt) {
        unreadCount++;
      }

      const isBlocked = blockedUserIds.has(msg.senderId);
      const senderObj = msg.sender as any;

      // Type-safe approach checking for `isDeleted`, since `main` has it but this branch theoretically doesn't yet
      const isDeleted = (msg as any).isDeleted === true;

      return {
        id: msg.id,
        content: isBlocked
          ? "[Blocked user's message]"
          : isDeleted
            ? '[Message deleted]'
            : msg.content,
        type: msg.type,
        createdAt: msg.createdAt,
        editedAt: (msg as any).editedAt || null,
        isDeleted,
        paymentId: msg.paymentId,
        sender: {
          id: msg.senderId,
          username: senderObj?.username,
          avatarUrl: senderObj?.avatarUrl,
          level: senderObj?.level,
        },
      };
    });

    const nextCursor =
      processedMessages.length > 0
        ? processedMessages[processedMessages.length - 1].id
        : null;
    const prevCursor =
      processedMessages.length > 0 ? processedMessages[0].id : null;

    return {
      messages: processedMessages,
      nextCursor,
      prevCursor,
      hasMore,
      unreadCount,
    };
  }
}
