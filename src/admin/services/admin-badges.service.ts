import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge } from '../../users/entities/badge.entity';
import { UserBadge } from '../../users/entities/user-badge.entity';
import { Quest } from '../../quest/entities/quest.entity';
import { CreateBadgeDto } from '../dto/create-badge.dto';
import { UpdateBadgeDto } from '../dto/update-badge.dto';
import { GetBadgesDto } from '../dto/get-badges.dto';
import { AuditLogService } from './audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { Request } from 'express';

@Injectable()
export class AdminBadgesService {
  private readonly logger = new Logger(AdminBadgesService.name);

  constructor(
    @InjectRepository(Badge)
    private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(UserBadge)
    private readonly userBadgeRepo: Repository<UserBadge>,
    @InjectRepository(Quest)
    private readonly questRepo: Repository<Quest>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createBadge(dto: CreateBadgeDto, adminId: string, req?: Request) {
    // imageUrl must be https when provided
    if (dto.imageUrl && !dto.imageUrl.startsWith('https://')) {
      throw new BadRequestException('imageUrl must be a valid HTTPS URL');
    }

    const badge = this.badgeRepo.create({
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl,
      category: dto.category,
      rarity: dto.rarity,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      createdById: adminId,
    });

    const saved = await this.badgeRepo.save(badge);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.BADGE_CREATED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: `Badge \"${saved.name}\" created`,
      metadata: { badgeId: saved.id, name: saved.name },
      resourceType: 'badge',
      resourceId: saved.id,
      req,
    });

    return saved;
  }

  async getBadges(query: GetBadgesDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.badgeRepo.createQueryBuilder('badge');

    if (query.category) qb.andWhere('badge.category = :category', { category: query.category });
    if (query.rarity) qb.andWhere('badge.rarity = :rarity', { rarity: query.rarity });
    if (query.isActive !== undefined) qb.andWhere('badge.isActive = :isActive', { isActive: query.isActive });

    qb.orderBy('badge.createdAt', 'DESC');

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { items, total, page, limit };
  }

  async getBadgeById(badgeId: string) {
    const badge = await this.badgeRepo.findOne({ where: { id: badgeId } });
    if (!badge) throw new NotFoundException('Badge not found');

    // users who hold this badge (paginated default)
    const holders = await this.userBadgeRepo.find({ where: { badge: { id: badgeId } }, relations: ['user'], take: 50 });

    const totalAwarded = await this.userBadgeRepo.count({ where: { badge: { id: badgeId } } });

    const associatedQuests = await this.questRepo.find({ where: { badgeRewardId: badgeId } });

    return { badge, holders, totalAwarded, associatedQuests };
  }

  async updateBadge(badgeId: string, dto: UpdateBadgeDto, adminId: string, req?: Request) {
    const badge = await this.badgeRepo.findOne({ where: { id: badgeId } });
    if (!badge) throw new NotFoundException('Badge not found');

    if (dto.imageUrl && !dto.imageUrl.startsWith('https://')) {
      throw new BadRequestException('imageUrl must be a valid HTTPS URL');
    }

    const updatable = ['name', 'description', 'imageUrl', 'category', 'rarity'];
    const changes: Record<string, any> = {};
    updatable.forEach((f) => {
      if (dto[f] !== undefined) {
        changes[f] = dto[f];
        badge[f] = dto[f];
      }
    });

    const updated = await this.badgeRepo.save(badge);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.BADGE_UPDATED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.LOW,
      details: `Badge \"${updated.name}\" updated`,
      metadata: { badgeId: updated.id, changes },
      resourceType: 'badge',
      resourceId: updated.id,
      req,
    });

    return updated;
  }

  async toggleBadge(badgeId: string, adminId: string, req?: Request) {
    const badge = await this.badgeRepo.findOne({ where: { id: badgeId } });
    if (!badge) throw new NotFoundException('Badge not found');

    badge.isActive = !badge.isActive;
    const updated = await this.badgeRepo.save(badge);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.BADGE_TOGGLED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: `Badge \"${updated.name}\" toggled to ${updated.isActive}`,
      metadata: { badgeId: updated.id, isActive: updated.isActive },
      resourceType: 'badge',
      resourceId: updated.id,
      req,
    });

    return updated;
  }

  async deleteBadge(badgeId: string, adminId: string, req?: Request) {
    const totalAwarded = await this.userBadgeRepo.count({ where: { badge: { id: badgeId } } });
    if (totalAwarded > 0) {
      throw new ConflictException('Cannot delete badge which has been awarded');
    }

    const badge = await this.badgeRepo.findOne({ where: { id: badgeId } });
    if (!badge) throw new NotFoundException('Badge not found');

    await this.badgeRepo.remove(badge);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.BADGE_DELETED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.HIGH,
      details: `Badge \"${badge.name}\" deleted`,
      metadata: { badgeId: badge.id },
      resourceType: 'badge',
      resourceId: badge.id,
      req,
    });
  }
}
