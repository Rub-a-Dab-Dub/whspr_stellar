import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChangelogService } from './changelog.service';
import {
  CreateChangelogDto,
  UpdateChangelogDto,
  MarkSeenDto,
} from './dto/changelog.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChangelogController {
  constructor(private readonly changelogService: ChangelogService) {}

  /* ──── public (authenticated user) ──── */

  @Get('changelog')
  getHistory(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.changelogService.getChangelogHistory(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('changelog/latest')
  getLatest() {
    return this.changelogService.getLatestChangelog();
  }

  @Get('changelog/unseen')
  getUnseen(@CurrentUser('id') userId: string) {
    return this.changelogService.getUnseen(userId);
  }

  @Get('changelog/unseen/count')
  getUnseenCount(@CurrentUser('id') userId: string) {
    return this.changelogService.getUnseenCount(userId);
  }

  @Post('changelog/mark-seen')
  markSeen(@CurrentUser('id') userId: string, @Body() dto: MarkSeenDto) {
    return this.changelogService.markSeen(userId, dto);
  }

  /* ──── admin ──── */

  @Post('admin/changelog')
  create(@Body() dto: CreateChangelogDto) {
    return this.changelogService.createChangelog(dto);
  }

  @Patch('admin/changelog/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChangelogDto,
  ) {
    return this.changelogService.updateChangelog(id, dto);
  }

  @Post('admin/changelog/:id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.changelogService.publishChangelog(id);
  }
}
