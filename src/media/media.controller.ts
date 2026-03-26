import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { MediaService } from './media.service';
import { PresignRequestDto } from './dto/presign-request.dto';
import { PresignResponseDto } from './dto/presign-response.dto';
import { ConfirmUploadResponseDto } from './dto/confirm-upload-response.dto';

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * POST /media/presign
   * Validates MIME type + file size then returns a pre-signed PUT URL.
   */
  @Post('presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a pre-signed upload URL for direct S3/R2 upload' })
  @ApiResponse({ status: 200, description: 'Pre-signed URL returned', type: PresignResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid MIME type or file size' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async presign(@Body() dto: PresignRequestDto): Promise<PresignResponseDto> {
    return this.mediaService.generatePresignedUpload(dto);
  }

  /**
   * POST /media/:key/confirm
   * Confirms the upload exists and enqueues async image processing.
   * The :key segment uses base64url encoding to avoid slash conflicts.
   */
  @Post(':key/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a completed upload and trigger post-processing' })
  @ApiParam({
    name: 'key',
    description: 'Base64url-encoded object key returned by /media/presign',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload confirmed, processing queued',
    type: ConfirmUploadResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Object not found in storage' })
  async confirm(@Param('key') encodedKey: string): Promise<ConfirmUploadResponseDto> {
    const key = Buffer.from(encodedKey, 'base64url').toString('utf8');
    return this.mediaService.confirmUpload(key);
  }

  /**
   * DELETE /media/:key
   * Deletes the original object and all resized variants.
   */
  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a media object and all its variants' })
  @ApiParam({
    name: 'key',
    description: 'Base64url-encoded object key',
  })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid key' })
  async remove(@Param('key') encodedKey: string): Promise<void> {
    const key = Buffer.from(encodedKey, 'base64url').toString('utf8');
    return this.mediaService.deleteMedia(key);
  }
}
