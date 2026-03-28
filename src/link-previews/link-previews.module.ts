import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { LinkPreview } from './link-preview.entity';
import { LinkPreviewsService } from './link-previews.service';
import { LinkPreviewsController } from './link-previews.controller';
import { LinkPreviewsRepository } from './link-previews.repository';
import { LinkPreviewsProcessor } from './link-previews.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([LinkPreview]),
    BullModule.registerQueue({
      name: 'link-previews',
    }),
    HttpModule,
  ],
  controllers: [LinkPreviewsController],
  providers: [LinkPreviewsService, LinkPreviewsRepository, LinkPreviewsProcessor],
  exports: [LinkPreviewsService],
})
export class LinkPreviewsModule {}
