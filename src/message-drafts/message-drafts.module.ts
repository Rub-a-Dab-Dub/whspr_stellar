import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '../messaging/messaging.module';
import { MessageDraft } from './entities/message-draft.entity';
import { MessageDraftsController } from './message-drafts.controller';
import { MessageDraftsService } from './message-drafts.service';

@Module({
  imports: [TypeOrmModule.forFeature([MessageDraft]), MessagingModule],
  controllers: [MessageDraftsController],
  providers: [MessageDraftsService],
  exports: [MessageDraftsService],
})
export class MessageDraftsModule {}
