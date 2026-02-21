import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateQuestTables1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create quests table
    await queryRunner.createTable(
      new Table({
        name: 'quests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'requirement',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'requirementCount',
            type: 'int',
          },
          {
            name: 'questType',
            type: 'enum',
            enum: ['daily', 'weekly', 'special'],
          },
          {
            name: 'rewardType',
            type: 'enum',
            enum: ['xp', 'token', 'both'],
          },
          {
            name: 'rewardAmount',
            type: 'int',
          },
          {
            name: 'activeUntil',
            type: 'timestamp',
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
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
        ],
      }),
      true,
    );

    // Create user_quest_progress table
    await queryRunner.createTable(
      new Table({
        name: 'user_quest_progress',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'questId',
            type: 'uuid',
          },
          {
            name: 'currentProgress',
            type: 'int',
            default: 0,
          },
          {
            name: 'isCompleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isClaimed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'claimedAt',
            type: 'timestamp',
            isNullable: true,
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
        ],
        uniques: [
          {
            name: 'UQ_user_quest',
            columnNames: ['userId', 'questId'],
          },
        ],
      }),
      true,
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'user_quest_progress',
      new TableForeignKey({
        columnNames: ['questId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'quests',
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.query(
      `CREATE INDEX "IDX_quests_active_until" ON "quests" ("activeUntil")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quests_quest_type" ON "quests" ("questType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quests_is_active" ON "quests" ("isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_quest_progress_user_id" ON "user_quest_progress" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_quest_progress_quest_id" ON "user_quest_progress" ("questId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_quest_progress_completed" ON "user_quest_progress" ("isCompleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_quest_progress');
    await queryRunner.dropTable('quests');
  }
}
