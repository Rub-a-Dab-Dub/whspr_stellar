import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { FeatureFlag } from './entities/feature-flag.entity';

@Injectable()
export class FeatureFlagsRepository extends Repository<FeatureFlag> {
  constructor(private readonly dataSource: DataSource) {
    super(FeatureFlag, dataSource.createEntityManager());
  }

  findAll(): Promise<FeatureFlag[]> {
    return this.find({ order: { key: 'ASC' } });
  }

  findByKey(key: string): Promise<FeatureFlag | null> {
    return this.findOne({ where: { key } });
  }
}
