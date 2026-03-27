import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserPreferredLocale1771700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'preferredLocale',
        type: 'varchar',
        length: '10',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'preferredLocale');
  }
}
