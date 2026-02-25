import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from './services/ipfs.service';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: VIDEO_MAX_BYTES,
      },
    }),
  )
  async uploadMedia(
    @Request() req: { user: { id?: string; sub?: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user.id ?? req.user.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    const mime = file.mimetype ?? '';
    if (!ALLOWED_MIMES.includes(mime)) {
      throw new BadRequestException(
        `Unsupported media type. Allowed: ${ALLOWED_MIMES.join(', ')}`,
      );
    }

    const maxBytes = mime === 'video/mp4' ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File too large. Max ${maxBytes / (1024 * 1024)}MB for ${mime}`,
      );
    }

    const result = await this.messagesService.uploadMedia(
      userId,
      file.buffer,
      mime,
    );

    return {
      success: true,
      data: {
        ipfsHash: result.ipfsHash,
        gatewayUrl: result.gatewayUrl,
        contentHash: result.contentHash,
        mediaType: result.mediaType,
      },
    };
  }

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Request() req: { user: { id?: string; sub?: string } },
    @Body() dto: SendMessageDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    const result = await this.messagesService.sendMessage(
      userId,
      BigInt(dto.roomId),
      dto.contentHash,
      BigInt(dto.tipAmount ?? 0),
    );

    if (!result.success) {
      throw new BadRequestException(result.error ?? 'Failed to send message');
    }

    return {
      success: true,
      data: {
        messageId: result.messageId?.toString(),
        transactionHash: result.transactionHash,
      },
    };
  }
}
