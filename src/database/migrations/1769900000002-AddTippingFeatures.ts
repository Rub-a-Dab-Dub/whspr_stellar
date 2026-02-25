import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddTippingFeatures1769900000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add XP column to users table
        await queryRunner.addColumn(
            'users',
            new TableColumn({
                name: 'xp',
                type: 'integer',
                default: 0,
            }),
        );

        // Add roomId and completedAt columns to payments table
        await queryRunner.addColumn(
            'payments',
            new TableColumn({
                name: 'room_id',
                type: 'varchar',
                isNullable: true,
            }),
        );

        await queryRunner.addColumn(
            'payments',
            new TableColumn({
                name: 'completed_at',
                type: 'timestamp',
                isNullable: true,
            }),
        );

        // Create messages table
        await queryRunner.createTable(
            new Table({
                name: 'messages',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'sender_id',
                        type: 'uuid',
                    },
                    {
                        name: 'room_id',
                        type: 'varchar',
                    },
                    {
                        name: 'type',
                        type: 'enum',
                        enum: ['TEXT', 'MEDIA', 'TIP'],
                        default: "'TEXT'",
                    },
                    {
                        name: 'content',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'payment_id',
                        type: 'uuid',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Create foreign key for sender_id
        await queryRunner.createForeignKey(
            'messages',
            new TableForeignKey({
                columnNames: ['sender_id'],
                referencedTableName: 'users',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // Create foreign key for payment_id
        await queryRunner.createForeignKey(
            'messages',
            new TableForeignKey({
                columnNames: ['payment_id'],
                referencedTableName: 'payments',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }),
        );

        // Create indexes
        await queryRunner.createIndex(
            'messages',
            new TableIndex({
                name: 'IDX_messages_room_id_created_at',
                columnNames: ['room_id', 'created_at'],
            }),
        );

        await queryRunner.createIndex(
            'messages',
            new TableIndex({
                name: 'IDX_messages_sender_id_created_at',
                columnNames: ['sender_id', 'created_at'],
            }),
        );

        await queryRunner.createIndex(
            'messages',
            new TableIndex({
                name: 'IDX_messages_payment_id',
                columnNames: ['payment_id'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop messages table indexes
        await queryRunner.dropIndex('messages', 'IDX_messages_payment_id');
        await queryRunner.dropIndex('messages', 'IDX_messages_sender_id_created_at');
        await queryRunner.dropIndex('messages', 'IDX_messages_room_id_created_at');

        // Drop messages table foreign keys
        const messagesTable = await queryRunner.getTable('messages');
        if (messagesTable) {
            const paymentFk = messagesTable.foreignKeys.find(
                (fk) => fk.columnNames.indexOf('payment_id') !== -1,
            );
            const senderFk = messagesTable.foreignKeys.find(
                (fk) => fk.columnNames.indexOf('sender_id') !== -1,
            );
            if (paymentFk) {
                await queryRunner.dropForeignKey('messages', paymentFk);
            }
            if (senderFk) {
                await queryRunner.dropForeignKey('messages', senderFk);
            }
        }

        // Drop messages table
        await queryRunner.dropTable('messages');

        // Drop columns from payments table
        await queryRunner.dropColumn('payments', 'completed_at');
        await queryRunner.dropColumn('payments', 'room_id');

        // Drop XP column from users table
        await queryRunner.dropColumn('users', 'xp');
    }
}
