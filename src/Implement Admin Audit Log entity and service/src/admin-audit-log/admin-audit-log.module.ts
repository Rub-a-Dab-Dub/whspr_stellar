import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminAuditLog } from "./entities";
import { AdminAuditLogService } from "./admin-audit-log.service";

@Module({
  imports: [TypeOrmModule.forFeature([AdminAuditLog])],
  providers: [AdminAuditLogService],
  exports: [AdminAuditLogService],
})
export class AdminAuditLogModule {}
