import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, ILike } from 'typeorm';
import { Quest, QuestStatus } from '../../quest/entities/quest.entity';
import { UserQuestProgress } from '../../quest/entities/user-quest-progress.entity';
import { CreateQuestDto } from '../dto/create-quest.dto';
import { UpdateQuestDto } from '../dto/update-quest.dto';
import { UpdateQuestStatusDto } from '../dto/update-quest-status.dto';
import { GetQuestsDto } from '../dto/get-quests.dto';
import { AuditLogService, AuditLogFilters } from './audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { Request } from 'express';

@Injectable()
export class AdminQuestService {
  private readonly logger = new Logger(AdminQuestService.name);

  constructor(
    @InjectRepository(Quest)
    private readonly questRepository: Repository<Quest>,
    @InjectRepository(UserQuestProgress)
    private readonly progressRepository: Repository<UserQuestProgress>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createQuest(
    createQuestDto: CreateQuestDto,
    adminId: string,
    req?: Request,
  ): Promise<Quest> {
    // Validate endDate is after startDate
    if (createQuestDto.startDate && createQuestDto.endDate) {
      if (new Date(createQuestDto.endDate) <= new Date(createQuestDto.startDate)) {
        throw new BadRequestException('endDate must be after startDate');
      }
    }

    const quest = this.questRepository.create({
      title: createQuestDto.title,
      description: createQuestDto.description,
      type: createQuestDto.type,
      xpReward: createQuestDto.xpReward,
      badgeRewardId: createQuestDto.badgeRewardId,
      condition: createQuestDto.condition,
      startDate: createQuestDto.startDate ? new Date(createQuestDto.startDate) : null,
      endDate: createQuestDto.endDate ? new Date(createQuestDto.endDate) : null,
      createdById: adminId,
      status: QuestStatus.INACTIVE,
    });

    const savedQuest = await this.questRepository.save(quest);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.QUEST_CREATED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: `Quest "${savedQuest.title}" created`,
      metadata: {
        questId: savedQuest.id,
        questTitle: savedQuest.title,
        questType: savedQuest.type,
        xpReward: savedQuest.xpReward,
      },
      resourceType: 'quest',
      resourceId: savedQuest.id,
      req,
    });

    return savedQuest;
  }

  async getQuests(
    query: GetQuestsDto,
    adminId: string,
    req?: Request,
  ): Promise<{ quests: Quest[]; total: number; page: number; limit: number }> {
    const {
      search,
      status,
      type,
      startDateAfter,
      endDateBefore,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const skip = (page - 1) * limit;
    const queryBuilder = this.questRepository.createQueryBuilder('quest');

    // Search by title or description
    if (search) {
      queryBuilder.andWhere(
        '(quest.title ILIKE :search OR quest.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Status filter
    if (status) {
      queryBuilder.andWhere('quest.status = :status', { status });
    }

    // Type filter
    if (type) {
      queryBuilder.andWhere('quest.type = :type', { type });
    }

    // Date range filters
    if (startDateAfter) {
      queryBuilder.andWhere('quest.startDate >= :startDateAfter', {
        startDateAfter: new Date(startDateAfter),
      });
    }

    if (endDateBefore) {
      queryBuilder.andWhere('quest.endDate <= :endDateBefore', {
        endDateBefore: new Date(endDateBefore),
      });
    }

    // Exclude soft-deleted quests
    queryBuilder.andWhere('quest.deletedAt = :deletedAt', { deletedAt: false });

    // Sorting
    queryBuilder.orderBy(`quest.${sortBy}`, sortOrder as 'ASC' | 'DESC');

    const [quests, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { quests, total, page, limit };
  }

  async getQuestById(questId: string, adminId: string): Promise<any> {
    const quest = await this.questRepository.findOne({
      where: { id: questId, deletedAt: false },
      relations: ['createdBy'],
    });

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    // Get completion stats
    const totalCompletions = await this.progressRepository
      .createQueryBuilder('progress')
      .where('progress.questId = :questId', { questId })
      .andWhere('progress.isCompleted = :isCompleted', { isCompleted: true })
      .getCount();

    const uniqueUsers = await this.progressRepository
      .createQueryBuilder('progress')
      .select('COUNT(DISTINCT progress.userId)', 'count')
      .where('progress.questId = :questId', { questId })
      .andWhere('progress.isCompleted = :isCompleted', { isCompleted: true })
      .getRawOne();

    // Calculate completion rate (simplified - assuming all users in system)
    const avgCompletionTime = await this.progressRepository
      .createQueryBuilder('progress')
      .select(
        'AVG(EXTRACT(EPOCH FROM (progress.completedAt - progress.createdAt)) / 3600)',
        'avgHours',
      )
      .where('progress.questId = :questId', { questId })
      .andWhere('progress.isCompleted = :isCompleted', { isCompleted: true })
      .getRawOne();

    return {
      ...quest,
      completionStats: {
        totalCompletions,
        uniqueUsers: parseInt(uniqueUsers?.count || '0'),
        completionRate: totalCompletions > 0 ? totalCompletions : 0,
        avgCompletionTimeHours: avgCompletionTime?.avgHours
          ? parseFloat(avgCompletionTime.avgHours).toFixed(2)
          : 0,
      },
    };
  }

  async updateQuest(
    questId: string,
    updateQuestDto: UpdateQuestDto,
    adminId: string,
    req?: Request,
  ): Promise<Quest> {
    const quest = await this.questRepository.findOne({
      where: { id: questId, deletedAt: false },
    });

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    // Validate endDate is after startDate
    const startDate = updateQuestDto.startDate
      ? new Date(updateQuestDto.startDate)
      : quest.startDate;
    const endDate = updateQuestDto.endDate
      ? new Date(updateQuestDto.endDate)
      : quest.endDate;

    if (startDate && endDate && endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const changes: Record<string, any> = {};
    const updatableFields = [
      'title',
      'description',
      'type',
      'xpReward',
      'badgeRewardId',
      'condition',
    ];

    updatableFields.forEach((field) => {
      if (updateQuestDto[field] !== undefined) {
        changes[field] = updateQuestDto[field];
      }
    });

    if (updateQuestDto.startDate) {
      changes.startDate = new Date(updateQuestDto.startDate);
    }

    if (updateQuestDto.endDate) {
      changes.endDate = new Date(updateQuestDto.endDate);
    }

    Object.assign(quest, changes);
    const updatedQuest = await this.questRepository.save(quest);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.QUEST_UPDATED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.LOW,
      details: `Quest "${updatedQuest.title}" updated`,
      metadata: {
        questId: updatedQuest.id,
        changes,
      },
      resourceType: 'quest',
      resourceId: updatedQuest.id,
      req,
    });

    return updatedQuest;
  }

  async updateQuestStatus(
    questId: string,
    statusDto: UpdateQuestStatusDto,
    adminId: string,
    req?: Request,
  ): Promise<Quest> {
    const quest = await this.questRepository.findOne({
      where: { id: questId, deletedAt: false },
    });

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    // Validate: Cannot activate quest with past endDate
    if (
      statusDto.status === QuestStatus.ACTIVE &&
      quest.endDate &&
      new Date(quest.endDate) <= new Date()
    ) {
      throw new BadRequestException(
        'Cannot activate quest with a past end date',
      );
    }

    const oldStatus = quest.status;
    quest.status = statusDto.status;
    const updatedQuest = await this.questRepository.save(quest);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.QUEST_STATUS_CHANGED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: `Quest "${updatedQuest.title}" status changed from ${oldStatus} to ${statusDto.status}. Reason: ${statusDto.reason}`,
      metadata: {
        questId: updatedQuest.id,
        oldStatus,
        newStatus: statusDto.status,
        reason: statusDto.reason,
      },
      resourceType: 'quest',
      resourceId: updatedQuest.id,
      req,
    });

    return updatedQuest;
  }

  async deleteQuest(
    questId: string,
    adminId: string,
    req?: Request,
  ): Promise<void> {
    const quest = await this.questRepository.findOne({
      where: { id: questId, deletedAt: false },
    });

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    // Check if quest has completions
    const completionCount = await this.progressRepository.countBy({
      questId,
      isCompleted: true,
    });

    if (completionCount > 0) {
      throw new ConflictException(
        'Cannot delete quest with active completions. Archive it instead.',
      );
    }

    // Soft delete
    quest.deletedAt = true;
    await this.questRepository.save(quest);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.QUEST_DELETED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.HIGH,
      details: `Quest "${quest.title}" deleted (soft delete)`,
      metadata: {
        questId: quest.id,
        questTitle: quest.title,
      },
      resourceType: 'quest',
      resourceId: quest.id,
      req,
    });
  }
}
