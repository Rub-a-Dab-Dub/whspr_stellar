import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { MessageMedia, MediaType } from './entities/message-media.entity';
import { User } from '../user/entities/user.entity';
import { IpfsService } from './services/ipfs.service';
import { IMediaScanService, MEDIA_SCAN_SERVICE } from './services/media-scan.service';
import { ContractMessageService } from './services/contract-message.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EventType } from '../analytics/entities/analytics-event.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
    private readonly ipfsService: IpfsService,
    @Inject(MEDIA_SCAN_SERVICE)
    private readonly mediaScanService: IMediaScanService,
    private readonly contractMessageService: ContractMessageService,
    private readonly analyticsService: AnalyticsService,
    private readonly eventEmitter: EventEmitter2,
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
}
