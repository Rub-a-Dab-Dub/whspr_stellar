import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { MessageForwardingService } from '../services/message-forwarding.service';
import {
  ForwardMessageDto,
  ForwardedMessageResponseDto,
  MessageForwardChainResponseDto,
} from '../dto/forward-message.dto';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageForwardingController {
  constructor(private readonly service: MessageForwardingService) {}

  @Post(':id/forward')
  @ApiOperation({
    summary: 'Forward a message to one or more conversations',
    description: 'Forward a message with content and attachments preserved to max 5 target conversations',
  })
  @ApiParam({
    name: 'id',
    description: 'Original message UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 201,
    type: [ForwardedMessageResponseDto],
    description: 'Array of forward records created',
  })
  async forwardMessage(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) messageId: string,
    @Body() dto: ForwardMessageDto,
  ): Promise<ForwardedMessageResponseDto[]> {
    // In a real implementation:
    // - Get the source conversation from message metadata
    // - Verify user is participant in source conversation
    // - Verify user is participant in all target conversations
    // - Verify message is not deleted

    const sourceConversationId = 'source-conv-id'; // Would fetch from message

    return this.service.forwardMessage(messageId, dto.targetConversationIds, userId, sourceConversationId);
  }

  @Get(':id/forward-chain')
  @ApiOperation({
    summary: 'Get forward chain for a message',
    description: 'Returns the chain of forwards for a message (limited to 3 hops)',
  })
  @ApiParam({
    name: 'id',
    description: 'Message UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    type: MessageForwardChainResponseDto,
    description: 'Forward chain details',
  })
  async getForwardChain(
    @Param('id', new ParseUUIDPipe()) messageId: string,
  ): Promise<MessageForwardChainResponseDto> {
    return this.service.getForwardChain(messageId);
  }
}
