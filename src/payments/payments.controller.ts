import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SessionKeyGuard } from '../session-keys/guards/session-key.guard';
import { RequiresSessionKeyScope } from '../session-keys/decorators/requires-session-key-scope.decorator';
import { SessionKeyScope } from '../session-keys/entities/session-key.entity';
import { SessionKeyService } from '../session-keys/session-keys.service';
import { PaymentsService } from './payments.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferQueryDto } from './dto/transfer-query.dto';
import { SessionKey } from '../session-keys/entities/session-key.entity';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly sessionKeyService: SessionKeyService,
  ) {}

  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionKeyGuard)
  @RequiresSessionKeyScope(SessionKeyScope.TRANSFER)
  @ApiOperation({
    summary:
      'Create a P2P transfer (supports session key via x-session-key header)',
  })
  @ApiHeader({
    name: 'x-session-key',
    required: false,
    description: 'Session key public key for paymaster-submitted transfers',
  })
  async createTransfer(
    @Request()
    req: { user: { id?: string; sub?: string }; sessionKey?: SessionKey },
    @Body() dto: CreateTransferDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    const payment = await this.paymentsService.createTransfer(
      userId,
      dto.recipient,
      dto.amount,
      dto.tokenAddress,
    );

    // Record spend against session key if one was used
    if (req.sessionKey && payment.status !== 'failed') {
      this.sessionKeyService
        .recordSpend(req.sessionKey.id, String(dto.amount))
        .catch((e) => console.warn(`recordSpend failed: ${e}`));
    }

    return {
      success: true,
      message: 'Transfer initiated successfully',
      data: payment,
    };
  }

  @Get('transfers')
  async getTransfers(
    @Request() req: { user: { id?: string; sub?: string } },
    @Query() query: TransferQueryDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    const { payments, total } = await this.paymentsService.getTransfers(
      userId,
      query.limit ?? 20,
      query.offset ?? 0,
    );
    return {
      success: true,
      data: payments,
      pagination: {
        total,
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
      },
    };
  }
}
