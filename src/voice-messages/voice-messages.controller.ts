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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import {
  ConfirmVoiceMessageDto,
  PresignVoiceMessageDto,
} from './dto/voice-message.dto';
import { VoiceMessagesService } from './voice-messages.service';

@ApiTags('voice-messages')
@ApiBearerAuth()
@Controller('voice-messages')
export class VoiceMessagesController {
  constructor(private readonly service: VoiceMessagesService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Generate a pre-signed upload URL (expires in 5 min)' })
  presign(
    @CurrentUser() user: UserResponseDto,
    @Body() dto: PresignVoiceMessageDto,
  ) {
    return this.service.presign(user, dto);
  }

  @Post('messages/:messageId/confirm')
  @ApiOperation({ summary: 'Confirm a completed upload and register the voice message' })
  confirm(
    @CurrentUser() user: UserResponseDto,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ConfirmVoiceMessageDto,
  ) {
    return this.service.confirm(user, messageId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a voice message by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Get('messages/:messageId')
  @ApiOperation({ summary: 'Fetch all confirmed voice messages for a chat message' })
  findByMessage(@Param('messageId', ParseUUIDPipe) messageId: string) {
    return this.service.findByMessageId(messageId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a voice message (owner only)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserResponseDto,
  ) {
    return this.service.delete(id, user.id);
  }
}
