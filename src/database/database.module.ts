import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [DatabaseService],
  controllers: [DatabaseController],
  exports: [DatabaseService],
})
export class DatabaseModule {}
