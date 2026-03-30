import { Controller, Get, Post, Query, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { LinkPreviewsService } from './link-previews.service';
import { GetPreviewDto } from './dto/get-preview.dto';
import { QueuePreviewsDto } from './dto/queue-previews.dto';

@Controller('link-previews')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class LinkPreviewsController {
  constructor(private readonly service: LinkPreviewsService) {}

  @Get()
  async getPreview(@Query() dto: GetPreviewDto) {
    return this.service.getPreview(dto.url);
  }

  @Post('queue')
  async queuePreviewUrls(@Body() dto: QueuePreviewsDto) {
    return this.service.queuePreviewUrls(dto.messageId, dto.urls);
  }
}
