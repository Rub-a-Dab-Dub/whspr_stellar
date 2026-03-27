import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RampService } from './ramp.service';
import { InitDepositDto, InitWithdrawalDto } from './dto/ramp-request.dto';
import { InitRampResponseDto, RampTransactionDto } from './dto/ramp-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('ramp')
@ApiBearerAuth()
@Controller('ramp')
export class RampController {
  constructor(private readonly rampService: RampService) {}

  @Post('deposit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate SEP-24 fiat deposit' })
  @ApiResponse({ status: 201, type: InitRampResponseDto })
  initDeposit(
    @CurrentUser('id') userId: string,
    @Body() dto: InitDepositDto,
  ): Promise<InitRampResponseDto> {
    return this.rampService.initDeposit(userId, dto);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate SEP-24 fiat withdrawal' })
  @ApiResponse({ status: 201, type: InitRampResponseDto })
  initWithdrawal(
    @CurrentUser('id') userId: string,
    @Body() dto: InitWithdrawalDto,
  ): Promise<InitRampResponseDto> {
    return this.rampService.initWithdrawal(userId, dto);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List all ramp transactions for the current user' })
  @ApiResponse({ status: 200, type: [RampTransactionDto] })
  getTransactions(@CurrentUser('id') userId: string): Promise<RampTransactionDto[]> {
    return this.rampService.getTransactions(userId);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get ramp transaction status (syncs from anchor)' })
  @ApiResponse({ status: 200, type: RampTransactionDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  checkStatus(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RampTransactionDto> {
    return this.rampService.checkStatus(userId, id);
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anchor webhook callback' })
  @ApiResponse({ status: 200 })
  handleCallback(@Body() payload: Record<string, unknown>): Promise<void> {
    return this.rampService.handleCallback(payload);
  }
}
