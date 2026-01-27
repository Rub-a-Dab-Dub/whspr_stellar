import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GaslessTransaction } from './entities/gasless-tx.entity';
import { SessionKey } from './entities/session-key.entity';
import { GasBudget } from './entities/gas-budget.entity';

import { GaslessController } from './controllers/gasless.controller';

import { MetaTxService } from './services/meta-tx.service';
import { RelayerService } from './services/relayer.service';
import { SessionKeyService } from './services/session-key.service';
import { GasBudgetService } from './services/gas-budget.service';
import { NonceService } from './services/nonce.service';
import { RetryService } from './services/retry.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GaslessTransaction,
      SessionKey,
      GasBudget,
    ]),
  ],
  controllers: [GaslessController],
  providers: [
    MetaTxService,
    RelayerService,
    SessionKeyService,
    GasBudgetService,
    NonceService,
    RetryService,
  ],
})
export class GaslessModule {}
