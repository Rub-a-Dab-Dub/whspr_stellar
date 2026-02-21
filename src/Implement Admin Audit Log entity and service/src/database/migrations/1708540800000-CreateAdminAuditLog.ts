import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateAdminAuditLog1708540800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "admin_audit_logs",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "gen_random_uuid()",
          },
          {
            name: "adminId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "adminEmail",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "action",
            type: "enum",
            enum: [
              "LOGIN",
              "LOGOUT",
              "BAN_USER",
              "UNBAN_USER",
              "DELETE_ROOM",
              "CLOSE_ROOM",
              "WITHDRAW",
              "CONFIG_CHANGE",
              "PERMISSION_CHANGE",
              "USER_CREATED",
              "USER_DELETED",
              "ROLE_ASSIGNED",
              "ROLE_REVOKED",
              "TRANSACTION_REVERSED",
              "SYSTEM_MAINTENANCE",
              "SECURITY_INCIDENT",
            ],
            isNullable: false,
            enumName: "admin_audit_log_action_enum",
          },
          {
            name: "targetType",
            type: "enum",
            enum: ["user", "room", "transaction", "platform", "system"],
            isNullable: false,
            enumName: "audit_log_target_type_enum",
          },
          {
            name: "targetId",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "metadata",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "ipAddress",
            type: "inet",
            isNullable: true,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes for common queries
    await queryRunner.createIndex(
      "admin_audit_logs",
      new TableIndex({
        name: "IDX_admin_audit_logs_adminId",
        columnNames: ["adminId"],
      }),
    );

    await queryRunner.createIndex(
      "admin_audit_logs",
      new TableIndex({
        name: "IDX_admin_audit_logs_action",
        columnNames: ["action"],
      }),
    );

    await queryRunner.createIndex(
      "admin_audit_logs",
      new TableIndex({
        name: "IDX_admin_audit_logs_targetType",
        columnNames: ["targetType"],
      }),
    );

    await queryRunner.createIndex(
      "admin_audit_logs",
      new TableIndex({
        name: "IDX_admin_audit_logs_createdAt",
        columnNames: ["createdAt"],
      }),
    );

    await queryRunner.createIndex(
      "admin_audit_logs",
      new TableIndex({
        name: "IDX_admin_audit_logs_adminId_createdAt",
        columnNames: ["adminId", "createdAt"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("admin_audit_logs");

    // TypeORM will automatically drop enum types when table is dropped
    await queryRunner.query("DROP TYPE IF EXISTS admin_audit_log_action_enum");
    await queryRunner.query("DROP TYPE IF EXISTS audit_log_target_type_enum");
  }
}
