import { Controller, Get, Param, Post, Query, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LocalizedParseUUIDPipe } from '../i18n/pipes/localized-parse-uuid.pipe';
import { EstimateTransferDto } from './dto/estimate-transfer.dto';
import { InitiateTransferDto } from './dto/initiate-transfer.dto';
import { TransferPreviewDto } from './dto/transfer-preview.dto';
import { TransferResponseDto } from './dto/transfer-response.dto';
import { InChatTransfersService } from './in-chat-transfers.service';
import { TransfersGateway } from './transfers.gateway';

@ApiTags('in-chat-transfers')
@ApiBearerAuth()
@Controller()
export class InChatTransfersController {
  constructor(
    private readonly inChatTransfersService: InChatTransfersService,
    private readonly transfersGateway: TransfersGateway,
  ) {}

  @Post('conversations/:id/transfers')
  @ApiOperation({ summary: 'Create a transfer preview for a conversation command' })
  @ApiResponse({ status: 201, type: TransferPreviewDto })
  async initiateTransfer(
    @CurrentUser('id') userId: string,
    @Param('id', LocalizedParseUUIDPipe) conversationId: string,
    @Body() dto: InitiateTransferDto,
  ): Promise<TransferPreviewDto> {
    const preview = await this.inChatTransfersService.initiateTransfer(userId, conversationId, dto);
    this.transfersGateway.emitTransferInitiated(conversationId, preview);

    return preview;
  }

  @Get('conversations/:id/transfers')
  @ApiOperation({ summary: 'List transfers for a conversation' })
  async listConversationTransfers(@Param('id', LocalizedParseUUIDPipe) conversationId: string) {
    return this.inChatTransfersService.listConversationTransfers(conversationId);
  }

  @Post('transfers/:id/confirm')
  @ApiOperation({ summary: 'Confirm and submit a pending transfer preview' })
  @ApiResponse({ status: 201, type: TransferResponseDto })
  async confirmTransfer(
    @CurrentUser('id') userId: string,
    @Param('id', LocalizedParseUUIDPipe) transferId: string,
  ): Promise<TransferResponseDto> {
    const response = await this.inChatTransfersService.confirmTransfer(transferId, userId);
    this.transfersGateway.emitTransferCompleted(response.conversationId, response);

    return response;
  }

  @Get('transfers/estimate')
  @ApiOperation({ summary: 'Estimate transfer fees before confirmation' })
  async estimateFee(@Query() query: EstimateTransferDto) {
    const asset = query.asset ?? 'XLM';
    const amount = (query.amount ?? 1).toFixed(7);
    const recipientCount = query.recipientCount ?? 1;
    const feeEstimate = await this.inChatTransfersService.estimateFee(
      asset,
      amount,
      recipientCount,
    );

    return {
      asset,
      amount,
      recipientCount,
      feeEstimate,
    };
  }
}
