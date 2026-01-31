import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUserTable1769891578000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'username',
            type: 'varchar',
            isUnique: true,
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            isUnique: true,
            isNullable: true,
          },
          {
            name: 'walletAddress',
            type: 'varchar',
            isUnique: true,
            isNullable: true,
          },
          {
            name: 'password',
            type: 'varchar',
            isNullable: true,
          },
          // Profile embedded columns
          {
            name: 'profileBio',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'profileAvatarUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'profileWebsite',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'profileLocation',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'isEmailVerified',
            type: 'boolean',
            default: false,
          },
          {
            name: 'emailVerificationToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'emailVerificationExpires',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'passwordResetToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'passwordResetExpires',
            type: 'timestamp',
            isNullable: true,
          },
          // Stats
          {
            name: 'currentXp',
            type: 'int',
            default: 0,
          },
          {
            name: 'level',
            type: 'int',
            default: 1,
          },
          {
            name: 'totalTips',
            type: 'int',
            default: 0,
          },
          // Security
          {
            name: 'loginAttempts',
            type: 'int',
            default: 0,
          },
          {
            name: 'lockoutUntil',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'refreshToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'isBanned',
            type: 'boolean',
            default: false,
          },
          {
            name: 'bannedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'bannedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'banReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'suspendedUntil',
            type: 'timestamp',
            isNullable: true,
          },
          // Timestamps
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_USERNAME',
        columnNames: ['username'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_EMAIL',
        columnNames: ['email'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_WALLET_ADDRESS',
        columnNames: ['walletAddress'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
