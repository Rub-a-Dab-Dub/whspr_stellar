import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsModule } from '../attachments/attachments.module';
import { CustomEmojiController } from './custom-emoji.controller';
import { CustomEmojiRepository } from './custom-emoji.repository';
import { CustomEmojiService } from './custom-emoji.service';
import { CustomEmoji } from './entities/custom-emoji.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomEmoji]),
    AttachmentsModule, // re-exports S3StorageService
  ],
  controllers: [CustomEmojiController],
  providers: [CustomEmojiService, CustomEmojiRepository],
  exports: [CustomEmojiService],
})
export class CustomEmojiModule {}
