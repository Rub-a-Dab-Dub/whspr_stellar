import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoiceMessage } from './entities/voice-message.entity';
import { VoiceMessageRepository } from './voice-message.repository';
import { VoiceMessagesService } from './voice-messages.service';
import { VoiceMessagesController } from './voice-messages.controller';
import { WaveformQueueService } from './waveform-queue.service';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [TypeOrmModule.forFeature([VoiceMessage]), AttachmentsModule],
  controllers: [VoiceMessagesController],
  providers: [VoiceMessageRepository, VoiceMessagesService, WaveformQueueService],
  exports: [VoiceMessagesService],
})
export class VoiceMessagesModule {}
