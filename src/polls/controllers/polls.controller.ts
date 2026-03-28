import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
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
import { PollsService } from '../services/polls.service';
import {
  CreatePollDto,
  CastVoteDto,
  PollResultResponseDto,
  PollListResponseDto,
} from '../dto/poll.dto';

@ApiTags('polls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PollsController {
  constructor(private readonly service: PollsService) {}

  @Post('conversations/:conversationId/polls')
  @ApiOperation({
    summary: 'Create a new poll in a conversation',
    description: 'Creates a poll with 2-10 options',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 201,
    type: PollResultResponseDto,
    description: 'Created poll',
  })
  async createPoll(
    @CurrentUser('id') userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body() dto: CreatePollDto,
  ): Promise<PollResultResponseDto> {
    // In a real implementation, verify user is participant in conversation
    return this.service.createPoll(conversationId, userId, dto);
  }

  @Get('conversations/:conversationId/polls')
  @ApiOperation({
    summary: 'Get all polls in a conversation',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    type: PollListResponseDto,
    description: 'List of polls',
  })
  async getPollsInConversation(
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
  ): Promise<PollListResponseDto> {
    return this.service.getPollsInConversation(conversationId);
  }

  @Get('polls/:id')
  @ApiOperation({
    summary: 'Get poll details with results',
  })
  @ApiParam({
    name: 'id',
    description: 'Poll UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    type: PollResultResponseDto,
    description: 'Poll details',
  })
  async getPoll(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) pollId: string,
  ): Promise<PollResultResponseDto> {
    return this.service.getPoll(pollId, userId);
  }

  @Post('polls/:id/vote')
  @ApiOperation({
    summary: 'Cast or update vote on poll',
  })
  @ApiParam({
    name: 'id',
    description: 'Poll UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    type: PollResultResponseDto,
    description: 'Updated poll results',
  })
  async castVote(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) pollId: string,
    @Body() dto: CastVoteDto,
  ): Promise<PollResultResponseDto> {
    // Emit WebSocket event "poll:updated" to subscribers
    return this.service.castVote(pollId, userId, dto);
  }

  @Delete('polls/:id/vote')
  @ApiOperation({
    summary: 'Retract vote from poll (before close)',
  })
  @ApiParam({
    name: 'id',
    description: 'Poll UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Vote retracted successfully',
  })
  async retractVote(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) pollId: string,
  ): Promise<{ message: string }> {
    await this.service.retractVote(pollId, userId);
    return { message: 'Vote retracted successfully' };
  }

  @Post('polls/:id/close')
  @ApiOperation({
    summary: 'Close a poll (only creator)',
  })
  @ApiParam({
    name: 'id',
    description: 'Poll UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    type: PollResultResponseDto,
    description: 'Closed poll',
  })
  async closePoll(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) pollId: string,
  ): Promise<PollResultResponseDto> {
    return this.service.closePoll(pollId, userId);
  }
}
