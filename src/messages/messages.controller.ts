import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
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
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SessionKeyGuard } from '../session-keys/guards/session-key.guard';
import { RequiresSessionKeyScope } from '../session-keys/decorators/requires-session-key-scope.decorator';
import { SessionKeyScope } from '../session-keys/entities/session-key.entity';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from './services/ipfs.service';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];

@ApiTags('messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: VIDEO_MAX_BYTES },
    }),
  )
  async uploadMedia(
    @Request() req: { user: { id?: string; sub?: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user.id ?? req.user.sub;
    if (!userId) throw new BadRequestException('User not authenticated');
    if (!file?.buffer) throw new BadRequestException('No file uploaded');

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
  @UseGuards(SessionKeyGuard)
  @RequiresSessionKeyScope(SessionKeyScope.MESSAGE)
  @ApiOperation({
    summary: 'Send a message (supports session key via x-session-key header)',
  })
  @ApiHeader({
    name: 'x-session-key',
    required: false,
    description: 'Session key public key for paymaster-submitted messages',
  })
  async sendMessage(
    @Request() req: { user: { id?: string; sub?: string } },
    @Body() dto: SendMessageDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    if (!userId) throw new BadRequestException('User not authenticated');

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

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a message (within 15 minutes)' })
  async editMessage(
    @Request() req: { user: { id?: string; sub?: string } },
    @Param('id') messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    if (!userId) throw new BadRequestException('User not authenticated');

    return this.messagesService.editMessage(userId, messageId, dto.content);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft delete a message (sender, moderator, or creator)',
  })
  async deleteMessage(
    @Request() req: { user: { id?: string; sub?: string } },
    @Param('id') messageId: string,
  ) {
    const userId = req.user.id ?? req.user.sub;
    if (!userId) throw new BadRequestException('User not authenticated');

    return this.messagesService.deleteMessage(userId, messageId);
  }
}
