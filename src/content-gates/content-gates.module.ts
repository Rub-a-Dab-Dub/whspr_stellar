import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentGate } from './entities/content-gate.entity';
import { ContentGatesService } from './content-gates.service';
import { ContentGatesController } from './content-gates.controller';
import { UsersModule } from '../users/users.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [TypeOrmModule.forFeature([ContentGate]), UsersModule, WalletsModule],
  controllers: [ContentGatesController],
  providers: [ContentGatesService],
  exports: [ContentGatesService],
})
export class ContentGatesModule {}
