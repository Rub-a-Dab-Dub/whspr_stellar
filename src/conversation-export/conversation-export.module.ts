import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from '../attachments/entities/attachment.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { ConversationExportController } from './conversation-export.controller';
import { ConversationExportService } from './conversation-export.service';
import { ConversationExportJob } from './entities/conversation-export-job.entity';
import { ConversationExportGenerator } from './services/conversation-export.generator';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      ConversationExportJob,
      Conversation,
      ConversationParticipant,
      Message,
      Attachment,
    ]),
  ],
  controllers: [ConversationExportController],
  providers: [ConversationExportService, ConversationExportGenerator],
  exports: [ConversationExportService],
})
export class ConversationExportModule {}
