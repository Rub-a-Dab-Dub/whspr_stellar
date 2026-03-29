import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnchorService } from './anchor.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AnchorDto,
  AnchorRateDto,
  AnchorTransactionDto,
  InitiateDepositDto,
  InitiateWithdrawalDto,
  InitiateTransactionResponseDto,
  RatesQueryDto,
} from './dto/anchor.dto';

@ApiTags('anchors')
@ApiBearerAuth()
@Controller('anchors')
export class AnchorController {
  constructor(private readonly anchorService: AnchorService) {}

  @Get()
  @ApiOperation({ summary: 'List all active anchors' })
  @ApiResponse({ status: 200, type: [AnchorDto] })
  discoverAnchors(): Promise<AnchorDto[]> {
    return this.anchorService.discoverAnchors();
  }

  @Get('rates')
  @ApiOperation({ summary: 'Compare rates across anchors (e.g. NGN → USDC)' })
  @ApiResponse({ status: 200, type: [AnchorRateDto] })
  @ApiQuery({ name: 'from', example: 'NGN' })
  @ApiQuery({ name: 'to', example: 'USDC' })
  @ApiQuery({ name: 'amount', required: false, example: 100 })
  getRates(@Query() query: RatesQueryDto): Promise<AnchorRateDto[]> {
    return this.anchorService.getBestAnchorRate(query.from, query.to, query.amount);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get anchor details by ID' })
  @ApiResponse({ status: 200, type: AnchorDto })
  @ApiResponse({ status: 404, description: 'Anchor not found' })
  getAnchor(@Param('id', ParseUUIDPipe) id: string): Promise<AnchorDto> {
    return this.anchorService.getAnchorInfo(id);
  }

  @Post(':id/deposit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate SEP-24 deposit via anchor' })
  @ApiResponse({ status: 201, type: InitiateTransactionResponseDto })
  initiateDeposit(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) anchorId: string,
    @Body() dto: InitiateDepositDto,
  ): Promise<InitiateTransactionResponseDto> {
    return this.anchorService.initiateDeposit(userId, anchorId, dto);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate SEP-24 withdrawal via anchor' })
  @ApiResponse({ status: 201, type: InitiateTransactionResponseDto })
  initiateWithdrawal(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) anchorId: string,
    @Body() dto: InitiateWithdrawalDto,
  ): Promise<InitiateTransactionResponseDto> {
    return this.anchorService.initiateWithdrawal(userId, anchorId, dto);
  }

  @Get('transactions/:txId/status')
  @ApiOperation({ summary: 'Poll transaction status from anchor' })
  @ApiResponse({ status: 200, type: AnchorTransactionDto })
  pollStatus(
    @Param('txId', ParseUUIDPipe) txId: string,
  ): Promise<AnchorTransactionDto> {
    return this.anchorService.pollTransactionStatus(txId);
  }
}
