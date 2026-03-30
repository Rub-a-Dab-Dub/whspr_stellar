import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BlockEnforcementController } from './block-enforcement.controller';
import { BlockEnforcementService } from './block-enforcement.service';
import { BlockEnforcementRepository } from './block-enforcement.repository';
import { UserBlock } from './entities/user-block.entity';
import { BlockGuard } from './block.guard';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserBlock]),
    EventEmitterModule.forRoot(),
    UserSettingsModule,
    ConversationsModule,
  ],
  controllers: [BlockEnforcementController],
  providers: [BlockEnforcementService, BlockEnforcementRepository, BlockGuard],
  exports: [BlockEnforcementService, BlockGuard],
})
export class BlockEnforcementModule {}
