import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { CommandFrameworkRepository } from './command-framework.repository';
import { BotCommand, CommandScope } from './entities/bot-command.entity';
import { PaginatedCommandsDto } from './dto/paginated-commands.dto';
import { BotsService } from '../bots/bots.service';
// TODO: import PaymentsService, WalletsService, AuditLogService, PollsService

@Injectable()
export class CommandFrameworkService {
  private readonly logger = new Logger(CommandFrameworkService.name);
  private readonly BUILT_IN_COMMANDS = new Map<string, (args: string[], ctx: any) => Promise<any>>([
    ['/help', this.executeHelp.bind(this)],
    ['/balance', this.executeBalance.bind(this)],
    // TODO: add /pay, /price, /swap, /members, /mute, /poll
  ]);

  constructor(
    private readonly repo: CommandFrameworkRepository,
    private readonly botsService: BotsService,
    // TODO: PaymentsService, WalletsService, AuditLogService
  ) {}

  async getAvailableCommands(
    conversationId: string, 
    userId: string, 
    query?: string
  ): Promise<PaginatedCommandsDto> {
    const commands = await this.repo.findAvailable(conversationId, query);
    return new PaginatedCommandsDto(commands, commands.length);
  }

  async routeCommand(conversationId: string, senderId: string, content: string) {
    const parsed = this.parseCommand(content);
    if (!parsed) {
      throw new NotFoundException('Invalid command format');
    }

    // Log audit
    // await this.auditLog.log(senderId, 'command.execute', { conversationId, command: parsed.command });

    const command = await this.repo.findEnabledByCommand(parsed.command);
    if (!command) {
      return { response: await this.getSuggestions(parsed.command) };
    }

    if (command.scope === CommandScope.BUILT_IN || !command.botId) {
      return await this.executeBuiltIn(parsed);
    } else {
      return await this.dispatchToBot(conversationId, parsed);
    }
  }

  registerCommand(dto: any): Promise<BotCommand> {
    return this.repo.register(dto);
  }

  unregisterCommand(commandId: string): Promise<void> {
    return this.repo.unregister(commandId);
  }

  getCommandHelp(command: string): Promise<string> {
    // impl
    return Promise.resolve('');
  }

  private parseCommand(content: string) {
    if (!content.trim().startsWith('/')) return null;
    const match = content.match(/^\/(\w+)(?:\s+(.*))?$/);
    if (!match) return null;
    const [, cmd, argsStr] = match;
    return {
      command: `/${cmd.toLowerCase()}`,
      args: argsStr ? this.parseArgs(argsStr) : [],
      raw: content,
    };
  }

  private parseArgs(argsStr: string): string[] {
    // Simple parser for @mentions, positional/named
    return argsStr.trim().split(/\s+/).filter(Boolean);
  }

  private async executeBuiltIn(parsed: any) {
    const handler = this.BUILT_IN_COMMANDS.get(parsed.command);
    if (handler) {
      const result = await handler(parsed.args, {});
      return { response: result };
    }
    return { response: 'Unknown built-in command' };
  }

  private async dispatchToBot(conversationId: string, parsed: any) {
    // Use BotsService.processCommand (assumes conversationId=groupId)
    const botResponse = await this.botsService.processCommand(conversationId, parsed.raw);
    return { response: botResponse || 'Command dispatched to bot' };
  }

  private async getSuggestions(command: string): Promise<string> {
    const similar = await this.repo.findAvailable('', command.slice(1));
    if (similar.length) {
      return `Did you mean: ${similar.map(c => c.command).join(', ')}?`;
    }
    return 'No matching commands found. Type /help for available commands.';
  }

  // Built-in handlers (stubs - full impl with deps)
  private async executeHelp(args: string[], ctx: any): Promise<string> {
    const commands = await this.repo.findAvailable(ctx.conversationId || '');
    return commands.map(c => `${c.command} - ${c.description}`).join('\\n');
  }

  private async executeBalance(args: string[], ctx: any): Promise<string> {
    // TODO: WalletsService.getBalance(ctx.senderId)
    return 'Balance: 100 XLM';
  }

  // TODO: /pay, /request, /price, /swap, /members, /mute, /poll
}

