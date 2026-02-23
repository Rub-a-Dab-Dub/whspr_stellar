import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { XpBoostEvent } from '../entities/xp-boost-event.entity';
import { CreateXpBoostEventDto } from '../dto/xp-boost/create-xp-boost-event.dto';
import { UpdateXpBoostEventDto } from '../dto/xp-boost/update-xp-boost-event.dto';
import { AuditLogService } from './audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { RedisService } from '../../redis/redis.service';

export const XP_BOOST_REDIS_KEY = 'xp:boost:active';

@Injectable()
export class XpBoostService {
  private readonly logger = new Logger(XpBoostService.name);

  constructor(
    @InjectRepository(XpBoostEvent)
    private readonly xpBoostEventRepository: Repository<XpBoostEvent>,
    private readonly auditLogService: AuditLogService,
    private readonly redisService: RedisService,
  ) {}

  async create(
    dto: CreateXpBoostEventDto,
    adminId: string,
    req?: Request,
  ): Promise<XpBoostEvent> {
    if (new Date(dto.endAt) <= new Date(dto.startAt)) {
      throw new BadRequestException('endAt must be after startAt');
    }

    const event = this.xpBoostEventRepository.create({
      name: dto.name,
      multiplier: dto.multiplier,
      appliesToActions: dto.appliesToActions,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      isActive: false,
      createdById: adminId,
    });

    const saved = await this.xpBoostEventRepository.save(event);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.XP_BOOST_CREATED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: `XP boost event "${saved.name}" created`,
      metadata: {
        eventId: saved.id,
        multiplier: saved.multiplier,
        appliesToActions: saved.appliesToActions,
        startAt: saved.startAt,
        endAt: saved.endAt,
      },
      resourceType: 'xp_boost_event',
      resourceId: saved.id,
      req,
    });

    return saved;
  }

  async findAll(): Promise<XpBoostEvent[]> {
    return this.xpBoostEventRepository.find({
      order: { startAt: 'DESC' },
    });
  }

  async getActive(): Promise<XpBoostEvent | null> {
    return this.xpBoostEventRepository.findOne({
      where: { isActive: true },
    });
  }

  async update(
    eventId: string,
    dto: UpdateXpBoostEventDto,
    adminId: string,
    req?: Request,
  ): Promise<XpBoostEvent> {
    const event = await this.xpBoostEventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('XP boost event not found');
    }

    if (event.isActive) {
      throw new BadRequestException('Cannot update an active XP boost event');
    }

    if (event.endAt <= new Date()) {
      throw new BadRequestException('Cannot update a past XP boost event');
    }

    const newStartAt = dto.startAt ? new Date(dto.startAt) : event.startAt;
    const newEndAt = dto.endAt ? new Date(dto.endAt) : event.endAt;

    if (newEndAt <= newStartAt) {
      throw new BadRequestException('endAt must be after startAt');
    }

    if (dto.name !== undefined) event.name = dto.name;
    if (dto.multiplier !== undefined) event.multiplier = dto.multiplier;
    if (dto.appliesToActions !== undefined)
      event.appliesToActions = dto.appliesToActions;
    if (dto.startAt !== undefined) event.startAt = new Date(dto.startAt);
    if (dto.endAt !== undefined) event.endAt = new Date(dto.endAt);

    const updated = await this.xpBoostEventRepository.save(event);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.XP_BOOST_UPDATED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.LOW,
      details: `XP boost event "${updated.name}" updated`,
      metadata: { eventId: updated.id },
      resourceType: 'xp_boost_event',
      resourceId: updated.id,
      req,
    });

    return updated;
  }

  async remove(
    eventId: string,
    adminId: string,
    req?: Request,
  ): Promise<void> {
    const event = await this.xpBoostEventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('XP boost event not found');
    }

    if (event.isActive) {
      throw new BadRequestException('Cannot delete an active XP boost event');
    }

    if (event.endAt <= new Date()) {
      throw new BadRequestException('Cannot delete a past XP boost event');
    }

    const eventName = event.name;
    await this.xpBoostEventRepository.remove(event);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.XP_BOOST_DELETED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.HIGH,
      details: `XP boost event "${eventName}" deleted`,
      metadata: { eventId, name: eventName },
      resourceType: 'xp_boost_event',
      resourceId: eventId,
      req,
    });
  }

  async activateEvent(event: XpBoostEvent): Promise<void> {
    event.isActive = true;
    await this.xpBoostEventRepository.save(event);

    const redisValue = JSON.stringify({
      eventId: event.id,
      name: event.name,
      multiplier: Number(event.multiplier),
      appliesToActions: event.appliesToActions,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
    });
    await this.redisService.set(XP_BOOST_REDIS_KEY, redisValue);

    await this.auditLogService.createAuditLog({
      actorUserId: null,
      action: AuditAction.XP_BOOST_ACTIVATED,
      eventType: AuditEventType.SYSTEM,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: `XP boost event "${event.name}" activated (system)`,
      metadata: {
        eventId: event.id,
        multiplier: event.multiplier,
        appliesToActions: event.appliesToActions,
      },
      resourceType: 'xp_boost_event',
      resourceId: event.id,
    });

    this.logger.log(
      `XP boost event "${event.name}" (${event.id}) activated — multiplier x${event.multiplier}`,
    );
  }

  async deactivateEvent(event: XpBoostEvent): Promise<void> {
    event.isActive = false;
    await this.xpBoostEventRepository.save(event);

    await this.redisService.del(XP_BOOST_REDIS_KEY);

    await this.auditLogService.createAuditLog({
      actorUserId: null,
      action: AuditAction.XP_BOOST_DEACTIVATED,
      eventType: AuditEventType.SYSTEM,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: `XP boost event "${event.name}" deactivated (system)`,
      metadata: { eventId: event.id },
      resourceType: 'xp_boost_event',
      resourceId: event.id,
    });

    this.logger.log(
      `XP boost event "${event.name}" (${event.id}) deactivated`,
    );
  }
}
