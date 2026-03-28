import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LocalizedParseUUIDPipe } from '../i18n/pipes/localized-parse-uuid.pipe';
import {
  ConversationExportDownloadResponseDto,
  ConversationExportJobResponseDto,
  ConversationExportStatusResponseDto,
  RequestConversationExportDto,
} from './dto/conversation-export.dto';
import { ConversationExportService } from './conversation-export.service';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationExportController {
  constructor(private readonly conversationExportService: ConversationExportService) {}

  @Post(':id/export')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Queue a conversation history export job' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 201, type: ConversationExportJobResponseDto })
  async requestExport(
    @CurrentUser('id') userId: string,
    @Param('id', LocalizedParseUUIDPipe) conversationId: string,
    @Body() body: RequestConversationExportDto,
  ): Promise<ConversationExportJobResponseDto> {
    const job = await this.conversationExportService.requestExport(
      userId,
      conversationId,
      body?.format,
    );

    return {
      jobId: job.id,
      status: job.status,
      format: job.format,
      requestedAt: job.requestedAt.toISOString(),
    };
  }

  @Get(':id/export/:jobId')
  @ApiOperation({ summary: 'Get status for a conversation export job' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiParam({ name: 'jobId', description: 'Conversation export job UUID' })
  @ApiResponse({ status: 200, type: ConversationExportStatusResponseDto })
  async getExportStatus(
    @CurrentUser('id') userId: string,
    @Param('id', LocalizedParseUUIDPipe) conversationId: string,
    @Param('jobId', LocalizedParseUUIDPipe) jobId: string,
  ): Promise<ConversationExportStatusResponseDto> {
    const job = await this.conversationExportService.getExportStatus(userId, conversationId, jobId);
    return {
      jobId: job.id,
      status: job.status,
      format: job.format,
      fileUrl: job.fileUrl || undefined,
      fileSize: job.fileSize || undefined,
      completedAt: job.completedAt ? job.completedAt.toISOString() : undefined,
      expiresAt: job.expiresAt ? job.expiresAt.toISOString() : undefined,
    };
  }

  @Get(':id/export/:jobId/download')
  @ApiOperation({ summary: 'Get pre-signed URL for a completed conversation export' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiParam({ name: 'jobId', description: 'Conversation export job UUID' })
  @ApiResponse({ status: 200, type: ConversationExportDownloadResponseDto })
  async downloadExport(
    @CurrentUser('id') userId: string,
    @Param('id', LocalizedParseUUIDPipe) conversationId: string,
    @Param('jobId', LocalizedParseUUIDPipe) jobId: string,
  ): Promise<ConversationExportDownloadResponseDto> {
    const job = await this.conversationExportService.downloadExport(userId, conversationId, jobId);

    return {
      url: job.fileUrl!,
      expiresAt: job.expiresAt!.toISOString(),
      format: job.format,
      fileSize: job.fileSize || undefined,
    };
  }
}
