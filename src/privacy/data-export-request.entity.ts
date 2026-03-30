import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

export enum ExportStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  READY = "READY",
  EXPIRED = "EXPIRED",
}

@Entity("data_export_requests")
export class DataExportRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column({ type: "enum", enum: ExportStatus, default: ExportStatus.PENDING })
  status: ExportStatus;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ type: "timestamp" })
  requestedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  expiresAt: Date;
}
