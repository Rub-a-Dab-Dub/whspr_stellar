import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { SorobanService } from './soroban.service';
import { SorobanClientService } from './services/soroban-client/soroban-client.service';
import { UserRegistryContractService } from './services/user-registry-contract/user-registry-contract.service';
import { MessagingContractService } from './services/messaging-contract/messaging-contract.service';
import { TokenTransferContractService } from './services/token-transfer-contract/token-transfer-contract.service';
import { GroupContractService } from './services/group-contract/group-contract.service';
import { TreasuryContractService } from './services/treasury-contract/treasury-contract.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'transactions',
    }),
  ],
  providers: [
    SorobanService,
    SorobanClientService,
    UserRegistryContractService,
    MessagingContractService,
    TokenTransferContractService,
    GroupContractService,
    TreasuryContractService,
  ],
  exports: [
    SorobanService,
    SorobanClientService,
    UserRegistryContractService,
    MessagingContractService,
    TokenTransferContractService,
    GroupContractService,
    TreasuryContractService,
  ],
})
export class SorobanModule {}