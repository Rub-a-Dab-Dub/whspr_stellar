import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Post,
  Req,
} from '@nestjs/common'
import { ActivityFeedService } from '../services/activity-feed.service'

@Controller('feed')
export class ActivityFeedController {
  constructor(private service: ActivityFeedService) {}

  @Get()
  getFeed(@Req() req, @Query('cursor') cursor?: string) {
    return this.service.getFeed(req.user.id, cursor)
  }

  @Get('unread-count')
  getUnread(@Req() req) {
    return this.service.getUnreadCount(req.user.id)
  }

  @Patch(':id/read')
  markRead(@Req() req, @Param('id') id: string) {
    return this.service.markRead(req.user.id, id)
  }

  @Post('read-all')
  markAll(@Req() req) {
    return this.service.markAllRead(req.user.id)
  }
}