import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ListTransactionsQueryDto } from '../dto/list-transactions-query.dto';
import {
  TransactionListResponseDto,
  TransactionResponseDto,
} from '../dto/transaction-response.dto';
import { TransactionsService } from '../services/transactions.service';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('transactions')
  @ApiOperation({ summary: 'List transactions for the authenticated user' })
  @ApiResponse({ status: 200, type: TransactionListResponseDto })
  getTransactions(
    @CurrentUser('id') userId: string,
    @CurrentUser('walletAddress') walletAddress: string | undefined,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<TransactionListResponseDto> {
    return this.transactionsService.getUserTransactions(userId, walletAddress, query);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get a single transaction by id' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  getTransaction(
    @CurrentUser('id') userId: string,
    @CurrentUser('walletAddress') walletAddress: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.getTransaction(userId, id, walletAddress);
  }

  @Get('conversations/:id/transactions')
  @ApiOperation({ summary: 'List conversation-linked transactions for the authenticated user' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, type: TransactionListResponseDto })
  getConversationTransactions(
    @CurrentUser('id') userId: string,
    @CurrentUser('walletAddress') walletAddress: string | undefined,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<TransactionListResponseDto> {
    return this.transactionsService.getConversationTransactions(
      userId,
      walletAddress,
      conversationId,
      query,
    );
  }

  @Post('transactions/:id/retry')
  @ApiOperation({ summary: 'Retry a failed transaction' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  retryTransaction(
    @CurrentUser('id') userId: string,
    @CurrentUser('walletAddress') walletAddress: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.retryFailed(userId, walletAddress, id);
  }
}
