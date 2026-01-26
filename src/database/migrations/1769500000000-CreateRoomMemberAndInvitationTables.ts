import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

export class CreateRoomMemberAndInvitationTables1769500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create room_members table
    await queryRunner.createTable(
      new Table({
        name: 'room_members',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'roomId',
            type: 'uuid',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['ADMIN', 'MODERATOR', 'MEMBER'],
            default: "'MEMBER'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'REMOVED'],
            default: "'ACTIVE'",
          },
          {
            name: 'permissions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'inviteToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'inviteStatus',
            type: 'varchar',
            default: "'ACCEPTED'",
          },
          {
            name: 'joinedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'lastActivityAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'kickReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'kickedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'kickedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create room_invitations table
    await queryRunner.createTable(
      new Table({
        name: 'room_invitations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'roomId',
            type: 'uuid',
          },
          {
            name: 'invitedById',
            type: 'uuid',
          },
          {
            name: 'invitedUserId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'invitedEmail',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED'],
            default: "'PENDING'",
          },
          {
            name: 'inviteToken',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'acceptedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'rejectedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'rejectionReason',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add unique constraint on (roomId, userId)
    await queryRunner.createUniqueConstraint(
      'room_members',
      new TableUnique({
        columnNames: ['roomId', 'userId'],
        name: 'UQ_room_members_roomId_userId',
      }),
    );

    // Add foreign keys for room_members
    await queryRunner.createForeignKey(
      'room_members',
      new TableForeignKey({
        columnNames: ['roomId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rooms',
        onDelete: 'CASCADE',
        name: 'FK_room_members_roomId',
      }),
    );

    await queryRunner.createForeignKey(
      'room_members',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_room_members_userId',
      }),
    );

    // Add foreign keys for room_invitations
    await queryRunner.createForeignKey(
      'room_invitations',
      new TableForeignKey({
        columnNames: ['roomId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rooms',
        onDelete: 'CASCADE',
        name: 'FK_room_invitations_roomId',
      }),
    );

    await queryRunner.createForeignKey(
      'room_invitations',
      new TableForeignKey({
        columnNames: ['invitedById'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_room_invitations_invitedById',
      }),
    );

    await queryRunner.createForeignKey(
      'room_invitations',
      new TableForeignKey({
        columnNames: ['invitedUserId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_room_invitations_invitedUserId',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'room_members',
      new TableIndex({
        columnNames: ['roomId'],
        name: 'IDX_room_members_roomId',
      }),
    );

    await queryRunner.createIndex(
      'room_members',
      new TableIndex({
        columnNames: ['userId'],
        name: 'IDX_room_members_userId',
      }),
    );

    await queryRunner.createIndex(
      'room_members',
      new TableIndex({
        columnNames: ['roomId', 'role'],
        name: 'IDX_room_members_roomId_role',
      }),
    );

    await queryRunner.createIndex(
      'room_invitations',
      new TableIndex({
        columnNames: ['roomId'],
        name: 'IDX_room_invitations_roomId',
      }),
    );

    await queryRunner.createIndex(
      'room_invitations',
      new TableIndex({
        columnNames: ['invitedUserId'],
        name: 'IDX_room_invitations_invitedUserId',
      }),
    );

    await queryRunner.createIndex(
      'room_invitations',
      new TableIndex({
        columnNames: ['status'],
        name: 'IDX_room_invitations_status',
      }),
    );

    await queryRunner.createIndex(
      'room_invitations',
      new TableIndex({
        columnNames: ['expiresAt'],
        name: 'IDX_room_invitations_expiresAt',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop room_invitations table
    await queryRunner.dropTable('room_invitations', true);

    // Drop room_members table
    await queryRunner.dropTable('room_members', true);
  }
}
