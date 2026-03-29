import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIModerationModule } from '../ai-moderation/ai-moderation.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { UsersModule } from '../users/users.module';
import { UserStickerPackDownload } from './entities/user-sticker-pack-download.entity';
import { UserStickerPack } from './entities/user-sticker-pack.entity';
import { UserSticker } from './entities/user-sticker.entity';
import { AdminUserStickerPackController } from './admin-user-sticker-pack.controller';
import { StickerWebpService } from './sticker-webp.service';
import { UserStickerPackController } from './user-sticker-pack.controller';
import { UserStickerPackService } from './user-sticker-pack.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserStickerPack, UserSticker, UserStickerPackDownload]),
    UsersModule,
    AIModerationModule,
    AttachmentsModule,
  ],
  controllers: [UserStickerPackController, AdminUserStickerPackController],
  providers: [UserStickerPackService, StickerWebpService],
  exports: [UserStickerPackService],
})
export class UserStickerPacksModule {}
