import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type AlertRule =
  | "spam"
  | "wash_trading"
  | "early_withdrawal"
  | "ip_registration_fraud"
  | "admin_new_ip";

@Entity("security_alerts")
@Index(["severity", "status"])
@Index(["rule"])
@Index(["createdAt"])
@Index(["userId"], { where: '"userId" IS NOT NULL' })
export class SecurityAlert {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "varchar",
    enum: [
      "spam",
      "wash_trading",
      "early_withdrawal",
      "ip_registration_fraud",
      "admin_new_ip",
    ],
  })
  rule: AlertRule;

  @Column({
    type: "varchar",
    enum: ["low", "medium", "high", "critical"],
  })
  severity: AlertSeverity;

  @Column({
    type: "varchar",
    enum: ["open", "acknowledged", "resolved"],
    default: "open",
  })
  status: AlertStatus;

  @Column({ type: "uuid", nullable: true })
  userId?: string;

  @Column({ type: "uuid", nullable: true })
  adminId?: string;

  @Column({ type: "jsonb", nullable: true })
  details?: Record<string, any>;

  @Column({ type: "text", nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  acknowledgedAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  resolvedAt?: Date;
}
