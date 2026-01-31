import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('system_config_versions')
@Index(['configId', 'version'], { unique: true })
export class SystemConfigVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  configId: string;

  @Column({ type: 'varchar', length: 200 })
  key: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'jsonb' })
  value: Record<string, any> | string | number | boolean | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
