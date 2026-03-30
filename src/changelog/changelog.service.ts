import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Changelog, ChangelogType } from './entities/changelog.entity';
import { UserChangelogView } from './entities/user-changelog-view.entity';
import {
  CreateChangelogDto,
  MarkSeenDto,
  UpdateChangelogDto,
} from './dto/changelog.dto';
import { NotificationIntegrationService } from '../notifications/services/notification-integration.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';

@Injectable()
export class ChangelogService {
  private readonly logger = new Logger(ChangelogService.name);

  constructor(
    @InjectRepository(Changelog)
    private readonly changelogRepo: Repository<Changelog>,
    @InjectRepository(UserChangelogView)
    private readonly viewRepo: Repository<UserChangelogView>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationIntegrationService,
  ) {}

  async createChangelog(dto: CreateChangelogDto): Promise<Changelog> {
    const entry = this.changelogRepo.create({
      version: dto.version,
      platform: dto.platform,
      title: dto.title,
      highlights: dto.highlights ?? [],
      fullContent: dto.fullContent ?? null,
      type: dto.type,
      isPublished: false,
      publishedAt: null,
    });
    return this.changelogRepo.save(entry);
  }

  async updateChangelog(
    id: string,
    dto: UpdateChangelogDto,
  ): Promise<Changelog> {
    const entry = await this.changelogRepo.findOne({ where: { id } });
    if (!entry) {
      throw new NotFoundException(`Changelog ${id} not found`);
    }
    Object.assign(entry, dto);
    return this.changelogRepo.save(entry);
  }

  async publishChangelog(id: string): Promise<Changelog> {
    const entry = await this.changelogRepo.findOne({ where: { id } });
    if (!entry) {
      throw new NotFoundException(`Changelog ${id} not found`);
    }
    entry.isPublished = true;
    entry.publishedAt = new Date();
    const saved = await this.changelogRepo.save(entry);

    if (
      entry.type === ChangelogType.FEATURE ||
      entry.type === ChangelogType.BREAKING
    ) {
      await this.notifyAllUsers(saved);
    }

    return saved;
  }

  async getChangelogHistory(
    page = 1,
    limit = 20,
  ): Promise<{ data: Changelog[]; total: number; page: number }> {
    const [data, total] = await this.changelogRepo.findAndCount({
      where: { isPublished: true },
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page };
  }

  async getLatestChangelog(): Promise<Changelog | null> {
    return this.changelogRepo.findOne({
      where: { isPublished: true },
      order: { publishedAt: 'DESC' },
    });
  }

  async markSeen(userId: string, dto: MarkSeenDto): Promise<void> {
    let view = await this.viewRepo.findOne({ where: { userId } });
    if (!view) {
      view = this.viewRepo.create({ userId, lastSeenVersion: null });
    }
    view.lastSeenVersion = dto.version;
    await this.viewRepo.save(view);
  }

  async getUnseen(userId: string): Promise<Changelog[]> {
    const view = await this.viewRepo.findOne({ where: { userId } });
    if (!view?.lastSeenVersion) {
      return this.changelogRepo.find({
        where: { isPublished: true },
        order: { publishedAt: 'DESC' },
      });
    }

    const lastSeen = await this.changelogRepo.findOne({
      where: { version: view.lastSeenVersion },
    });

    if (!lastSeen?.publishedAt) {
      return [];
    }

    return this.changelogRepo
      .createQueryBuilder('cl')
      .where('cl.isPublished = :pub', { pub: true })
      .andWhere('cl.publishedAt > :ts', { ts: lastSeen.publishedAt })
      .orderBy('cl.publishedAt', 'DESC')
      .getMany();
  }

  async getUnseenCount(userId: string): Promise<number> {
    const unseen = await this.getUnseen(userId);
    return unseen.length;
  }

  private async notifyAllUsers(entry: Changelog): Promise<void> {
    try {
      const rows: { id: string }[] = await this.dataSource.query(
        `SELECT id FROM users WHERE "deletedAt" IS NULL LIMIT 5000`,
      );
      const userIds = rows.map((r) => r.id);
      if (!userIds.length) return;

      const typeLabel =
        entry.type === ChangelogType.BREAKING ? '⚠️ Breaking' : '🆕 Feature';

      await this.notificationService.bulkNotify(
        userIds,
        NotificationType.SYSTEM,
        `${typeLabel} Update: v${entry.version}`,
        entry.title,
        { version: entry.version, type: entry.type, platform: entry.platform },
        `/changelog/${entry.version}`,
      );
    } catch (error) {
      this.logger.error('Failed to broadcast changelog notification:', error);
    }
  }
}
