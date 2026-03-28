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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import { CastVoteDto } from './dto/cast-vote.dto';
import { CreatePollDto } from './dto/create-poll.dto';
import { PollResponseDto } from './dto/poll-response.dto';
import { PollsService } from './polls.service';

@ApiTags('polls')
@ApiBearerAuth()
@Controller()
export class PollsController {
  constructor(
    private readonly pollsService: PollsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('conversations/:id/polls')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a poll in a conversation' })
  @ApiResponse({ status: 201, type: PollResponseDto })
  createPoll(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: CreatePollDto,
  ): Promise<PollResponseDto> {
    return this.pollsService.createPoll(userId, conversationId, dto);
  }

  @Get('conversations/:id/polls')
  @ApiOperation({ summary: 'List polls in a conversation' })
  @ApiResponse({ status: 200, type: [PollResponseDto] })
  getPollsInConversation(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ): Promise<PollResponseDto[]> {
    return this.pollsService.getPollsInConversation(userId, conversationId);
  }

  @Get('polls/:id')
  @ApiOperation({ summary: 'Get a poll with results' })
  @ApiResponse({ status: 200, type: PollResponseDto })
  getPoll(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) pollId: string,
  ): Promise<PollResponseDto> {
    return this.pollsService.getPollResults(userId, pollId);
  }

  @Post('polls/:id/vote')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cast or update a vote for a poll' })
  @ApiResponse({ status: 201, type: PollResponseDto })
  async castVote(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) pollId: string,
    @Body() dto: CastVoteDto,
  ): Promise<PollResponseDto> {
    const response = await this.pollsService.castVote(userId, pollId, dto);
    const payload = await this.pollsService.getPollRealtimePayload(pollId);
    await this.chatGateway.sendPollUpdated(response.conversationId, payload);
    return response;
  }

  @Delete('polls/:id/vote')
  @ApiOperation({ summary: 'Retract a vote from a poll' })
  @ApiResponse({ status: 200, type: PollResponseDto })
  async retractVote(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) pollId: string,
  ): Promise<PollResponseDto> {
    const response = await this.pollsService.retractVote(userId, pollId);
    const payload = await this.pollsService.getPollRealtimePayload(pollId);
    await this.chatGateway.sendPollUpdated(response.conversationId, payload);
    return response;
  }

  @Post('polls/:id/close')
  @ApiOperation({ summary: 'Close a poll' })
  @ApiResponse({ status: 201, type: PollResponseDto })
  async closePoll(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) pollId: string,
  ): Promise<PollResponseDto> {
    const response = await this.pollsService.closePoll(userId, pollId);
    const payload = await this.pollsService.getPollRealtimePayload(pollId);
    await this.chatGateway.sendPollUpdated(response.conversationId, payload);
    return response;
  }
}
