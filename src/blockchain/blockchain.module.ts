import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainEvent } from './entities/blockchain-event.entity';
import { BlockchainCursor } from './entities/blockchain-cursor.entity';
import { SorobanRpcService } from './services/soroban-rpc.service';
import { BlockchainSyncService } from './services/blockchain-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainEvent, BlockchainCursor])],
  providers: [SorobanRpcService, BlockchainSyncService],
  exports: [BlockchainSyncService],
})
export class BlockchainModule {}
