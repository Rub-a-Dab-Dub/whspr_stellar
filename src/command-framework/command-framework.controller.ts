import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CommandFrameworkService } from './command-framework.service';
import { ExecuteCommandDto } from './dto/execute-command.dto';
import { PaginatedCommandsDto } from './dto/paginated-commands.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('command-framework')
@ApiBearerAuth()
@Controller('conversations/:conversationId/commands')
@UseGuards(/* auth guards from other controllers */)
export class CommandFrameworkController {
  constructor(private service: CommandFrameworkService) {}

@Get()
  @ApiOperation({ summary: 'Get available commands (autocomplete)' })
  async getAvailableCommands(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser('id') userId: string,
    @Query('q') query?: string,
  ): Promise<PaginatedCommandsDto> {
    return this.service.getAvailableCommands(conversationId, userId, query);
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute slash command' })
  async executeCommand(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: ExecuteCommandDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.routeCommand(conversationId, userId!, dto.content);
  }
}

