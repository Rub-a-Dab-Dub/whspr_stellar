import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

@Entity('activity_feed')
export class ActivityFeedItem {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column()
  userId: string

  @Column()
  actorId: string

  @Column()
  activityType: string

  @Column()
  resourceType: string

  @Column({ nullable: true })
  resourceId: string

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>

  @Column({ default: false })
  isRead: boolean

  @CreateDateColumn()
  createdAt: Date
}