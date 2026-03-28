import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AppPlatform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  WEB = 'WEB',
}

@Entity('app_versions')
@Index(['platform', 'publishedAt'])
export class AppVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: AppPlatform })
  @Index('idx_app_versions_platform')
  platform!: AppPlatform;

  @Column({ type: 'varchar', length: 50 })
  version!: string;

  @Column({ type: 'varchar', length: 50 })
  minSupportedVersion!: string;

  @Column({ type: 'text', nullable: true })
  releaseNotes!: string | null;

  @Column({ type: 'boolean', default: false })
  isForceUpdate!: boolean;

  @Column({ type: 'boolean', default: false })
  isSoftUpdate!: boolean;

  @Column({ type: 'timestamp' })
  publishedAt!: Date;

  @Column({ type: 'boolean', default: false })
  isDeprecated!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
