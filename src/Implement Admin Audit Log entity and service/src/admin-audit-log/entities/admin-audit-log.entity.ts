import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";
import { AdminAuditLogAction, AuditLogTargetType } from "../enums";

@Entity("admin_audit_logs")
@Index(["adminId"])
@Index(["action"])
@Index(["targetType"])
@Index(["createdAt"])
@Index(["adminId", "createdAt"])
export class AdminAuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  adminId: string;

  @Column("varchar", { length: 255 })
  adminEmail: string;

  @Column("enum", { enum: AdminAuditLogAction })
  action: AdminAuditLogAction;

  @Column("enum", { enum: AuditLogTargetType })
  targetType: AuditLogTargetType;

  @Column("varchar", { length: 255, nullable: true })
  targetId: string | null;

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any> | null;

  @Column("inet", { nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
