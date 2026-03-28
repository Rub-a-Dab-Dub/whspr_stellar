import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { BlockchainTransactionsService } from '../services/blockchain-transactions.service';
import {
  ListBlockchainTransactionsQueryDto,
} from '../dto/blockchain-transaction.dto';
import {
  BlockchainTransactionResponseDto,
  BlockchainTransactionListResponseDto,
} from '../dto/blockchain-transaction-response.dto';

@ApiTags('blockchain-transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('blockchain/transactions')
export class BlockchainTransactionsController {
  constructor(private readonly service: BlockchainTransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List blockchain transactions for authenticated user',
    description: 'Returns paginated list of blockchain transactions with optional filtering',
  })
  @ApiResponse({
    status: 200,
    type: BlockchainTransactionListResponseDto,
    description: 'Paginated list of transactions',
  })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query() query: ListBlockchainTransactionsQueryDto,
  ): Promise<BlockchainTransactionListResponseDto> {
    return this.service.getUserTransactions(userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single blockchain transaction',
    description: 'Retrieve details of a specific blockchain transaction',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    type: BlockchainTransactionResponseDto,
    description: 'Transaction details',
  })
  async getTransaction(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<BlockchainTransactionResponseDto> {
    const transaction = await this.service.getTransaction(id);

    // Verify user ownership
    const isOwner = await this.service.verifyUserOwnership(id, userId);
    if (!isOwner) {
      throw new BadRequestException('You do not have access to this transaction');
    }

    return transaction;
  }
}
