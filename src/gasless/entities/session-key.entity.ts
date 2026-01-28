import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('session_keys')
export class SessionKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  publicKey: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;
}
