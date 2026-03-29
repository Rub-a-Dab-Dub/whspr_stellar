import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThanOrEqual, Repository } from 'typeorm';
import { AppPlatform, AppVersion } from './entities/app-version.entity';

@Injectable()
export class AppVersionRepository {
  constructor(
    @InjectRepository(AppVersion)
    private readonly repo: Repository<AppVersion>,
  ) {}

  create(data: Partial<AppVersion>): AppVersion {
    return this.repo.create(data);
  }

  save(entity: AppVersion): Promise<AppVersion> {
    return this.repo.save(entity);
  }

  findById(id: string): Promise<AppVersion | null> {
    return this.repo.findOne({ where: { id } });
  }

  findLatestPublished(platform: AppPlatform): Promise<AppVersion | null> {
    return this.repo.findOne({
      where: {
        platform,
        isDeprecated: false,
        publishedAt: LessThanOrEqual(new Date()),
      },
      order: {
        publishedAt: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  findHistory(where: FindOptionsWhere<AppVersion>): Promise<AppVersion[]> {
    return this.repo.find({
      where,
      order: {
        publishedAt: 'DESC',
        createdAt: 'DESC',
      },
    });
  }
}
