import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AddBotToGroupDto } from './dto/add-bot-to-group.dto';
import { BotResponseDto } from './dto/bot-response.dto';
import { CreateBotDto } from './dto/create-bot.dto';
import { GroupBotParticipantDto } from './dto/group-bot-participant.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { BotsService } from './bots.service';

@ApiTags('bots')
@ApiBearerAuth()
@Controller()
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post('bots')
  @ApiOperation({ summary: 'Create a bot' })
  @ApiResponse({ status: 201, type: BotResponseDto })
  createBot(
    @CurrentUser('id') ownerId: string,
    @Body() dto: CreateBotDto,
  ): Promise<BotResponseDto> {
    return this.botsService.createBot(ownerId, dto);
  }

  @Get('bots')
  @ApiOperation({ summary: 'List current user bots' })
  @ApiResponse({ status: 200, type: BotResponseDto, isArray: true })
  getBots(@CurrentUser('id') ownerId: string): Promise<BotResponseDto[]> {
    return this.botsService.getBots(ownerId);
  }

  @Patch('bots/:id')
  @ApiOperation({ summary: 'Update a bot' })
  @ApiResponse({ status: 200, type: BotResponseDto })
  updateBot(
    @CurrentUser('id') ownerId: string,
    @Param('id') botId: string,
    @Body() dto: UpdateBotDto,
  ): Promise<BotResponseDto> {
    return this.botsService.updateBot(ownerId, botId, dto);
  }

  @Delete('bots/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a bot' })
  @ApiResponse({ status: 204 })
  async deleteBot(@CurrentUser('id') ownerId: string, @Param('id') botId: string): Promise<void> {
    await this.botsService.deleteBot(ownerId, botId);
  }

  @Post('groups/:id/bots')
  @ApiOperation({ summary: 'Add a bot to a group' })
  @ApiResponse({ status: 201, type: GroupBotParticipantDto })
  addBotToGroup(
    @CurrentUser('id') ownerId: string,
    @Param('id') groupId: string,
    @Body() dto: AddBotToGroupDto,
  ): Promise<GroupBotParticipantDto> {
    return this.botsService.addToGroup(ownerId, groupId, dto.botId);
  }

  @Delete('groups/:id/bots/:botId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a bot from a group' })
  @ApiResponse({ status: 204 })
  async removeBotFromGroup(
    @CurrentUser('id') ownerId: string,
    @Param('id') groupId: string,
    @Param('botId') botId: string,
  ): Promise<void> {
    await this.botsService.removeFromGroup(ownerId, groupId, botId);
  }
}
