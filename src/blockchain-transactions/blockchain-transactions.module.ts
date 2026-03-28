import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainTransaction } from './entities/blockchain-transaction.entity';
import { BlockchainTransactionsController } from './controllers/blockchain-transactions.controller';
import { BlockchainTransactionsService } from './services/blockchain-transactions.service';
import { BlockchainTransactionsRepository } from './repositories/blockchain-transactions.repository';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainTransaction])],
  controllers: [BlockchainTransactionsController],
  providers: [BlockchainTransactionsService, BlockchainTransactionsRepository],
  exports: [BlockchainTransactionsService],
})
export class BlockchainTransactionsModule {}
