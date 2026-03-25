import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum ContactStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  BLOCKED = 'BLOCKED',
}

@Entity('contacts')
@Unique(['ownerId', 'contactId'])
@Index(['ownerId'])
@Index(['contactId'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The user who owns this contact entry */
  @Column({ type: 'uuid' })
  ownerId: string;

  /** The user being referenced as a contact */
  @Column({ type: 'uuid' })
  contactId: string;

  @Column({
    type: 'enum',
    enum: ContactStatus,
    default: ContactStatus.PENDING,
  })
  status: ContactStatus;

  /** Optional label/nickname for the contact */
  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
