import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  Res,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator'; // assume exists
import { AdminGuard } from '../admin/admin.guard'; // assume or create
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';

import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { GetFeedbackQueryDto } from './dto/get-feedback-query.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import { FeedbackStatsDto } from './dto/feedback-stats.dto';

@ApiTags('Feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @Post('submit')
  @Public()
  @ApiOperation({ summary: 'Submit feedback/bug/feature request (anonymous OK)' })
  @ApiResponse({ status: 201, description: 'Feedback submitted', type: FeedbackResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input or screenshot' })
  async submit(
    @Body() dto: CreateFeedbackDto,
    @Headers() headers: any,
    @CurrentUser() user?: UserResponseDto,
  ): Promise<FeedbackResponseDto> {
    return this.service.submitFeedback(dto, headers as any, user?.id);
  }

  @Get('admin/queue')
  @AdminGuard()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin feedback queue (filterable)' })
  @ApiQuery({ name: 'type', enum: String, required: false })
  @ApiQuery({ name: 'status', enum: String, required: false })
  @ApiQuery({ name: 'priority', enum: String, required: false })
  @ApiResponse({ status: 200, description: 'Paginated queue' })
  findAll(@Query() query: GetFeedbackQueryDto) {
    return this.service.getFeedbackQueue(query);
  }

  @Patch('admin/:id')
  @AdminGuard()
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: FeedbackResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFeedbackDto) {
    return this.service.updateStatus(id, dto);
  }

  @Get('admin/stats')
  @AdminGuard()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get aggregated feedback statistics (cached)' })
  @ApiResponse({ status: 200, type: FeedbackStatsDto })
  getStats() {
    return this.service.getFeedbackStats();
  }

  @Get('admin/export')
  @AdminGuard()
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Export feedback queue as CSV' })
  @ApiQuery({ name: 'type', enum: String, required: false })
  async export(@Query() query: GetFeedbackQueryDto, @Res() res: Response) {
    const csv = await this.service.exportFeedback(query);
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename=feedback.csv');
    res.send(csv);
  }
}
