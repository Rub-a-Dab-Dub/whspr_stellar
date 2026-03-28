import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("consent_records")
export class ConsentRecord {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  consentType: string;

  @Column({ default: true })
  isGranted: boolean;

  @Column()
  ipAddress: string;

  @Column()
  userAgent: string;

  @Column({ type: "timestamp" })
  grantedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  revokedAt: Date;
}
