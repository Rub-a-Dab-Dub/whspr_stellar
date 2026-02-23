import {
  Controller,
  UseGuards,
  Delete,
  Param,
  Body,
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../roles/guards/role.guard';
import { Roles } from '../../roles/decorators/roles.decorator';
import { RoleType } from '../../roles/entities/role.entity';
import { MessageModerationService } from '../Services/message-moderation.service';
import { DeleteMessageDto } from '../dto/moderation.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RoleGuard)
export class AdminModerationController {
  constructor(
    private readonly moderationService: MessageModerationService,
  ) {}

  @Delete('rooms/:roomId/messages/:messageId')
  @Roles(RoleType.MODERATOR, RoleType.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
    @Body() deleteMessageDto: DeleteMessageDto,
    @Request() req: any,
  ) {
    // Extract moderatorId from authenticated user
    const moderatorId = req.user?.id || req.user?.sub;

    if (!moderatorId) {
      throw new BadRequestException('Unable to identify moderator');
    }

    try {
      // Call moderationService.deleteMessage
      const result = await this.moderationService.deleteMessage(
        roomId,
        messageId,
        moderatorId,
        deleteMessageDto.reason,
      );

      // Return formatted response with success, message data, and auditLogId
      return {
        success: result.success,
        message: {
          id: result.message.id,
          roomId: result.message.roomId,
          content: result.message.content,
          deletedAt: result.message.deletedAt.toISOString(),
          deletedBy: result.message.deletedBy,
        },
        auditLogId: result.auditLogId,
      };
    } catch (error) {
      // Map service errors to appropriate HTTP status codes
      if (error.message === 'Message not found') {
        throw new NotFoundException('Message not found');
      }
      if (
        error.message === 'Message does not belong to the specified room'
      ) {
        throw new BadRequestException(
          'Message does not belong to the specified room',
        );
      }
      // Re-throw other errors
      throw error;
    }
  }
}
