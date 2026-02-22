import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminAuditLogModule } from "./admin-audit-log";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      username: process.env.DB_USERNAME || "postgres",
      password: process.env.DB_PASSWORD || "password",
      database: process.env.DB_DATABASE || "admin_audit_log_db",
      entities: ["src/**/*.entity.ts"],
      migrations: ["src/database/migrations/*.ts"],
      migrationsRun: true,
      synchronize: false,
      logging: process.env.DB_LOGGING === "true",
    }),
    AdminAuditLogModule,
  ],
})
export class AppModule {}
