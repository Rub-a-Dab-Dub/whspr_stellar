import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoomStats1740510650000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE room_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "roomId" UUID NOT NULL,
        "messageCount" INT DEFAULT 0,
        "uniqueSenders" INT DEFAULT 0,
        "tipVolume" DECIMAL(20, 7) DEFAULT 0,
        "peakConcurrent" INT DEFAULT 0,
        "periodStart" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_room_stats_roomId ON room_stats ("roomId");
    `);

    await queryRunner.query(`
      CREATE INDEX idx_room_stats_periodStart ON room_stats ("periodStart");
    `);

    await queryRunner.query(`
      CREATE INDEX idx_room_stats_roomId_periodStart ON room_stats ("roomId", "periodStart");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE room_stats;`);
  }
}
