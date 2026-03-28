import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AttachmentsService } from './attachments.service';
import { PresignAttachmentDto } from './dto/presign-attachment.dto';
import { PresignAttachmentResponseDto } from './dto/presign-attachment-response.dto';
import { AttachmentResponseDto } from './dto/attachment-response.dto';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Generate pre-signed upload URL for direct client upload' })
  @ApiResponse({ status: 201, type: PresignAttachmentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid MIME type or file size' })
  presign(
    @CurrentUser() user: UserResponseDto,
    @Body() dto: PresignAttachmentDto,
  ): Promise<PresignAttachmentResponseDto> {
    return this.attachmentsService.generateUploadUrl(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attachment metadata by ID' })
  @ApiParam({ name: 'id', description: 'Attachment UUID' })
  @ApiResponse({ status: 200, type: AttachmentResponseDto })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  getAttachment(@Param('id', ParseUUIDPipe) id: string): Promise<AttachmentResponseDto> {
    return this.attachmentsService.getAttachment(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an attachment and remove object from storage' })
  @ApiParam({ name: 'id', description: 'Attachment UUID' })
  @ApiResponse({ status: 204, description: 'Attachment deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete another user attachment' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async deleteAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.attachmentsService.deleteAttachment(id, userId);
  }
}
