import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
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
import { WithdrawalsService } from './withdrawals.service';
import {
  RejectWithdrawalDto,
  WithdrawalRequestFilterDto,
} from './dto/withdrawal.dto';
import { RolesGuard, Roles, UserRole } from '../common/guards/roles.guard';

// Replace with your actual JWT/Auth guard
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Admin - Withdrawals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/withdrawals')
export class AdminWithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  /**
   * GET /admin/withdrawals/requests
   * Lists withdrawal requests (default: pending)
   */
  @Get('requests')
  @ApiOperation({
    summary: 'List withdrawal requests',
    description:
      'Returns paginated withdrawal requests. Defaults to pending status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of withdrawal requests',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            userId: 'user-uuid',
            username: 'john_doe',
            walletAddress: '0xAbc...',
            amount: 5000,
            chain: 'ETH',
            status: 'pending',
            riskScore: 55,
            isNewAddress: true,
            requestedAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 42,
        page: 1,
        limit: 20,
      },
    },
  })
  async listRequests(@Query() filters: WithdrawalRequestFilterDto) {
    return this.withdrawalsService.listPendingRequests(filters);
  }

  /**
   * POST /admin/withdrawals/requests/:requestId/approve
   * Approves a pending withdrawal and queues the on-chain transfer
   */
  @Post('requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a withdrawal request',
    description: 'Approves the request and queues it for on-chain execution.',
  })
  @ApiParam({ name: 'requestId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Withdrawal approved and queued' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 409, description: 'Request is not in pending state' })
  async approveRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() req: Request,
  ) {
    const admin = {
      id: (req.user as any).id,
      username: (req.user as any).username,
      ipAddress: req.ip,
    };

    return this.withdrawalsService.approveRequest(requestId, admin);
  }

  /**
   * POST /admin/withdrawals/requests/:requestId/reject
   * Rejects a withdrawal and notifies the user
   */
  @Post('requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a withdrawal request',
    description:
      'Rejects the request and notifies the user with the provided reason.',
  })
  @ApiParam({ name: 'requestId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Withdrawal rejected' })
  @ApiResponse({ status: 400, description: 'Invalid body' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 409, description: 'Request is not in pending state' })
  async rejectRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RejectWithdrawalDto,
    @Req() req: Request,
  ) {
    const admin = {
      id: (req.user as any).id,
      username: (req.user as any).username,
      ipAddress: req.ip,
    };

    return this.withdrawalsService.rejectRequest(requestId, dto, admin);
  }

  /**
   * GET /admin/withdrawals/requests/:requestId
   * Returns full details of a single request
   */
  @Get('requests/:requestId')
  @ApiOperation({ summary: 'Get a withdrawal request by ID' })
  @ApiParam({ name: 'requestId', type: 'string', format: 'uuid' })
  async getRequest(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.withdrawalsService.getRequestById(requestId);
  }

  /**
   * GET /admin/withdrawals/requests/:requestId/audit-log
   * Returns the full audit trail for a request
   */
  @Get('requests/:requestId/audit-log')
  @ApiOperation({
    summary: 'Get audit log for a withdrawal request',
    description: 'Returns every admin action taken on this withdrawal request.',
  })
  @ApiParam({ name: 'requestId', type: 'string', format: 'uuid' })
  async getAuditLog(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.withdrawalsService.getAuditLogs(requestId);
  }
}
