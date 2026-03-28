import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MessageDraftsService } from './message-drafts.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { DraftResponseDto } from './dto/draft-response.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class MessageDraftsController {
  constructor(private readonly draftsService: MessageDraftsService) {}

  @Put('conversations/:id/draft')
  saveDraft(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SaveDraftDto,
  ): Promise<DraftResponseDto> {
    return this.draftsService.saveDraft(userId, conversationId, dto);
  }

  @Get('conversations/:id/draft')
  getDraft(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ): Promise<DraftResponseDto> {
    return this.draftsService.getDraft(userId, conversationId);
  }

  @Delete('conversations/:id/draft')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDraft(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ): Promise<void> {
    return this.draftsService.deleteDraft(userId, conversationId);
  }

  @Get('drafts')
  getAllDrafts(@CurrentUser('id') userId: string): Promise<DraftResponseDto[]> {
    return this.draftsService.getAllDrafts(userId);
  }
}
