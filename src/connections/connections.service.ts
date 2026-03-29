import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { InAppNotificationType } from '../notifications/entities/notification.entity';
import { ConnectionPushNotifier } from './connection-push.notifier';
import {
  canonicalPair,
  ConnectionsRepository,
} from './connections.repository';
import {
  ConnectionListSortField,
  ConnectionRequestDirection,
  ConnectionRequestResponseDto,
  ListConnectionRequestsQueryDto,
  ListConnectionsQueryDto,
  ProfessionalConnectionResponseDto,
  SendConnectionRequestDto,
} from './dto/connection.dto';
import { ConnectionRequest, ConnectionRequestStatus } from './entities/connection-request.entity';
import { ProfessionalConnection } from './entities/professional-connection.entity';

const DECLINE_RESEND_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
/** Acceptance: in-app + push path should complete within 5 seconds under normal conditions. */
export const CONNECTION_NOTIFY_SLA_MS = 5000;

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    private readonly repo: ConnectionsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly pushNotifier: ConnectionPushNotifier,
  ) {}

  async sendRequest(actorId: string, dto: SendConnectionRequestDto): Promise<ConnectionRequestResponseDto> {
    if (actorId === dto.receiverId) {
      throw new BadRequestException('Cannot send a connection request to yourself');
    }

    const receiverExists = await this.repo.userExists(dto.receiverId);
    if (!receiverExists) {
      throw new NotFoundException('Receiver not found');
    }

    const senderExists = await this.repo.userExists(actorId);
    if (!senderExists) {
      throw new NotFoundException('Sender not found');
    }

    const [one, two] = canonicalPair(actorId, dto.receiverId);
    const existingConn = await this.repo.findProfessionalConnection(one, two);
    if (existingConn) {
      throw new ConflictException('You are already connected with this user');
    }

    const pending = await this.repo.findPendingRequestBetween(actorId, dto.receiverId);
    if (pending) {
      throw new ConflictException('A pending request already exists');
    }

    const latestDecline = await this.repo.findLatestDeclinedBetween(actorId, dto.receiverId);
    if (latestDecline?.respondedAt) {
      const elapsed = Date.now() - new Date(latestDecline.respondedAt).getTime();
      if (elapsed < DECLINE_RESEND_COOLDOWN_MS) {
        throw new BadRequestException(
          'A declined request cannot be re-sent for 30 days after the decline',
        );
      }
    }

    const entity = Object.assign(new ConnectionRequest(), {
      senderId: actorId,
      receiverId: dto.receiverId,
      introMessage: dto.introMessage.trim(),
      status: ConnectionRequestStatus.PENDING,
      respondedAt: null,
    });

    const saved = await this.repo.saveRequest(entity);

    await this.deliverRequestNotifications(saved);

    return this.toRequestDto(saved);
  }

  async acceptRequest(actorId: string, requestId: string): Promise<ProfessionalConnectionResponseDto> {
    const req = await this.repo.findConnectionRequestById(requestId);
    if (!req) {
      throw new NotFoundException('Connection request not found');
    }
    if (req.receiverId !== actorId) {
      throw new ForbiddenException('Only the receiver can accept this request');
    }
    if (req.status !== ConnectionRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    const [one, two] = canonicalPair(req.senderId, req.receiverId);
    const dup = await this.repo.findProfessionalConnection(one, two);
    if (dup) {
      throw new ConflictException('Already connected');
    }

    req.status = ConnectionRequestStatus.ACCEPTED;
    req.respondedAt = new Date();
    await this.repo.saveRequest(req);

    const mutualCount = await this.repo.countMutualProfessionals(req.senderId, req.receiverId);
    const conn = new ProfessionalConnection();
    conn.userOneId = one;
    conn.userTwoId = two;
    conn.mutualCount = mutualCount;
    const savedConn = await this.repo.saveConnection(conn);

    await this.repo.refreshMutualCountsForUsers([req.senderId, req.receiverId]);

    const reloaded = await this.repo.findProfessionalConnection(one, two);
    return this.toConnectionDto(actorId, reloaded ?? savedConn);
  }

  async declineRequest(actorId: string, requestId: string): Promise<ConnectionRequestResponseDto> {
    const req = await this.repo.findConnectionRequestById(requestId);
    if (!req) {
      throw new NotFoundException('Connection request not found');
    }
    if (req.receiverId !== actorId) {
      throw new ForbiddenException('Only the receiver can decline this request');
    }
    if (req.status !== ConnectionRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    req.status = ConnectionRequestStatus.DECLINED;
    req.respondedAt = new Date();
    const saved = await this.repo.saveRequest(req);
    return this.toRequestDto(saved);
  }

  async withdrawRequest(actorId: string, requestId: string): Promise<ConnectionRequestResponseDto> {
    const req = await this.repo.findConnectionRequestById(requestId);
    if (!req) {
      throw new NotFoundException('Connection request not found');
    }
    if (req.senderId !== actorId) {
      throw new ForbiddenException('Only the sender can withdraw this request');
    }
    if (req.status !== ConnectionRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    req.status = ConnectionRequestStatus.WITHDRAWN;
    req.respondedAt = new Date();
    const saved = await this.repo.saveRequest(req);
    return this.toRequestDto(saved);
  }

  async removeConnection(actorId: string, peerUserId: string): Promise<void> {
    if (actorId === peerUserId) {
      throw new BadRequestException('Invalid peer');
    }
    const [one, two] = canonicalPair(actorId, peerUserId);
    const row = await this.repo.findProfessionalConnection(one, two);
    if (!row) {
      throw new NotFoundException('No professional connection with this user');
    }

    await this.repo.deleteProfessionalConnection(one, two);
    await this.repo.refreshMutualCountsForUsers([actorId, peerUserId]);
  }

  async getConnections(
    actorId: string,
    query: ListConnectionsQueryDto,
  ): Promise<ProfessionalConnectionResponseDto[]> {
    const sortBy = query.sortBy ?? ConnectionListSortField.CONNECTED_AT;
    const order = query.order ?? 'desc';

    const rows = await this.repo.findAllConnectionsForUser(actorId);
    const dtos = rows.map((r) => this.toConnectionDto(actorId, r));

    const dir = order === 'asc' ? 1 : -1;
    dtos.sort((a, b) => {
      if (sortBy === ConnectionListSortField.MUTUAL_COUNT) {
        const cmp = a.mutualCount - b.mutualCount;
        return cmp === 0 ? dir * (new Date(a.connectedAt).getTime() - new Date(b.connectedAt).getTime()) : cmp * dir;
      }
      const t = new Date(a.connectedAt).getTime() - new Date(b.connectedAt).getTime();
      return t * dir;
    });

    return dtos;
  }

  async getConnectionRequests(
    actorId: string,
    query: ListConnectionRequestsQueryDto,
  ): Promise<ConnectionRequestResponseDto[]> {
    const direction = query.direction ?? ConnectionRequestDirection.INCOMING;
    const rows = await this.repo.listRequestsForUser(actorId, direction);
    return rows.map((r) => this.toRequestDto(r));
  }

  async getMutualConnections(actorId: string, otherUserId: string): Promise<string[]> {
    if (actorId === otherUserId) {
      throw new BadRequestException('otherUserId must differ from the current user');
    }
    const [one, two] = canonicalPair(actorId, otherUserId);
    const edge = await this.repo.findProfessionalConnection(one, two);
    if (!edge) {
      throw new BadRequestException('You are not connected with this user');
    }
    return this.repo.listMutualProfessionalUserIds(actorId, otherUserId);
  }

  async getConnectionCount(actorId: string): Promise<number> {
    const rows = await this.repo.findAllConnectionsForUser(actorId);
    return rows.length;
  }

  private async deliverRequestNotifications(req: ConnectionRequest): Promise<void> {
    const started = Date.now();
    const preview =
      req.introMessage.length > 120 ? `${req.introMessage.slice(0, 117)}...` : req.introMessage;

    await Promise.all([
      this.notificationsService.createNotification({
        userId: req.receiverId,
        type: InAppNotificationType.CONNECTION_REQUEST,
        title: 'Professional connection request',
        body: preview,
        data: {
          kind: 'professional_connection_request',
          requestId: req.id,
          senderId: req.senderId,
        },
      }),
      this.pushNotifier.notifyConnectionRequest(req.receiverId, {
        requestId: req.id,
        senderId: req.senderId,
        introPreview: preview,
      }),
    ]);

    const elapsed = Date.now() - started;
    if (elapsed > CONNECTION_NOTIFY_SLA_MS) {
      this.logger.warn(`connection request notification path took ${elapsed}ms (SLA ${CONNECTION_NOTIFY_SLA_MS}ms)`);
    }
  }

  private toRequestDto(r: ConnectionRequest): ConnectionRequestResponseDto {
    return {
      id: r.id,
      senderId: r.senderId,
      receiverId: r.receiverId,
      introMessage: r.introMessage,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
    };
  }

  private toConnectionDto(viewerId: string, row: ProfessionalConnection): ProfessionalConnectionResponseDto {
    const peerUserId = row.userOneId === viewerId ? row.userTwoId : row.userOneId;
    return {
      id: row.id,
      peerUserId,
      connectedAt: row.connectedAt.toISOString(),
      mutualCount: row.mutualCount,
    };
  }
}
