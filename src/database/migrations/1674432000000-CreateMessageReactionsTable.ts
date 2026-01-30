import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateMessageReactionsTable1674432000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create message_reactions table
    await queryRunner.createTable(
      new Table({
        name: 'message_reactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'messageId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'isCustom',
            type: 'boolean',
            default: false,
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
        foreignKeys: [
          {
            columnNames: ['messageId'],
            referencedTableName: 'messages',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'NO ACTION',
          },
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'NO ACTION',
          },
        ],
      }),
      true, // skipIfExists
    );

    // Create indexes for performance
    // Index 1: For finding reactions by message and type
    await queryRunner.createIndex(
      'message_reactions',
      new TableIndex({
        name: 'idx_message_reactions_message_type',
        columnNames: ['messageId', 'type'],
      }),
    );

    // Index 2: For finding user's reactions on a message
    await queryRunner.createIndex(
      'message_reactions',
      new TableIndex({
        name: 'idx_message_reactions_message_user',
        columnNames: ['messageId', 'userId'],
      }),
    );

    // Index 3: For user analytics queries
    await queryRunner.createIndex(
      'message_reactions',
      new TableIndex({
        name: 'idx_message_reactions_user_created',
        columnNames: ['userId', 'createdAt'],
      }),
    );

    // Unique constraint: User can only have one reaction of each type per message
    await queryRunner.createUniqueConstraint(
      'message_reactions',
      new TableUnique({
        name: 'uq_message_reactions_message_user_type',
        columnNames: ['messageId', 'userId', 'type'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop table
    await queryRunner.dropTable('message_reactions', true);
  }
}
