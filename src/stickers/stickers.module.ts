import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StickersService } from './stickers.service';
import { StickersController, GifsController } from './stickers.controller';
import { StickersRepository } from './stickers.repository';
import { StickerPacksRepository } from './sticker-packs.repository';
import { Sticker } from './entities/sticker.entity';
import { StickerPack } from './entities/sticker-pack.entity';
import { CacheService } from '../services/cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sticker, StickerPack])],
  providers: [StickersService, StickersRepository, StickerPacksRepository, CacheService],
  controllers: [StickersController, GifsController],
  exports: [StickersService],
})
export class StickersModule {}
