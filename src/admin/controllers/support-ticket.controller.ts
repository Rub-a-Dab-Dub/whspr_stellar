import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RoleGuard } from '../../roles/guards/role.guard';
import { Roles } from '../../roles/decorators/roles.decorator';
import { UserRole } from '../../roles/entities/role.entity';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SupportTicketService } from '../services/support-ticket.service';
import { ListTicketsDto } from '../dto/support-ticket/list-tickets.dto';
import { UpdateTicketDto } from '../dto/support-ticket/update-ticket.dto';
import { ReplyTicketDto } from '../dto/support-ticket/reply-ticket.dto';
import { AssignTicketDto } from '../dto/support-ticket/assign-ticket.dto';
import { ResolveTicketDto } from '../dto/support-ticket/resolve-ticket.dto';
import { BulkTicketActionDto } from '../dto/support-ticket/bulk-ticket-action.dto';

@ApiTags('admin-support')
@ApiBearerAuth()
@UseGuards(RoleGuard)
@Controller('admin/support/tickets')
export class SupportTicketController {
  constructor(private readonly supportTicketService: SupportTicketService) {}

  // ─── Read + Reply (MODERATOR or above) ───────────────────────────────────

  @Get()
  @Roles(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List support tickets with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of tickets' })
  async list(@Query() dto: ListTicketsDto) {
    return this.supportTicketService.listTickets(dto);
  }

  @Get(':ticketId')
  @Roles(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a single ticket with all messages (oldest-first)' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  @ApiResponse({ status: 200, description: 'Full ticket detail' })
  async getOne(@Param('ticketId') ticketId: string) {
    return this.supportTicketService.getTicket(ticketId);
  }

  @Post(':ticketId/messages')
  @Roles(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin reply to a support ticket (notifies user)' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  @ApiResponse({ status: 201, description: 'Message created' })
  async reply(
    @Param('ticketId') ticketId: string,
    @Body() dto: ReplyTicketDto,
    @CurrentUser() user: any,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.supportTicketService.replyToTicket(ticketId, adminId, dto);
  }

  // ─── Status / priority changes (ADMIN or above) ──────────────────────────

  @Patch(':ticketId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update ticket status, priority, category, or assignee' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  async update(
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.supportTicketService.updateTicket(ticketId, adminId, dto, req);
  }

  @Post(':ticketId/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign ticket to an admin (notifies assignee)' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  async assign(
    @Param('ticketId') ticketId: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.supportTicketService.assignTicket(ticketId, adminId, dto, req);
  }

  @Post(':ticketId/resolve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark ticket as resolved with a resolution note' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  async resolve(
    @Param('ticketId') ticketId: string,
    @Body() dto: ResolveTicketDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.supportTicketService.resolveTicket(ticketId, adminId, dto, req);
  }

  @Post(':ticketId/close')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Close a resolved ticket. Auto-close also runs after 72 h.',
  })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  async close(@Param('ticketId') ticketId: string) {
    return this.supportTicketService.closeTicket(ticketId);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Run bulk action on support tickets (partial success supported)' })
  @ApiResponse({
    status: 200,
    description:
      'Bulk action result with succeeded ticket IDs and failed ticket IDs with reasons',
  })
  async bulkAction(
    @Body() dto: BulkTicketActionDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.supportTicketService.bulkActionTickets(dto, adminId, req);
  }
}
