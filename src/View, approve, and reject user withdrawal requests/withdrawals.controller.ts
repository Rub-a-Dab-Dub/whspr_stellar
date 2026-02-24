import {
  Controller,
  Post,
  Body,
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
} from '@nestjs/swagger';
import { Request } from 'express';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalRequestDto } from './dto/withdrawal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Withdrawals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  /**
   * POST /withdrawals/request
   * User submits a withdrawal request.
   * Automatically approved if under AUTO_APPROVE_WITHDRAWAL_THRESHOLD with low risk.
   */
  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a withdrawal request',
    description:
      'Requests below AUTO_APPROVE_WITHDRAWAL_THRESHOLD with low risk score are ' +
      'automatically approved. Others are queued for admin review.',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request created (or auto-approved)',
    schema: {
      example: {
        id: 'uuid',
        status: 'pending',
        riskScore: 30,
        autoApproved: false,
        requestedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  async requestWithdrawal(
    @Body() dto: CreateWithdrawalRequestDto,
    @Req() req: Request,
  ) {
    // In production, userId/username come from JWT, not from body
    // dto.userId = (req.user as any).id;
    // dto.username = (req.user as any).username;
    return this.withdrawalsService.createRequest(dto);
  }
}
