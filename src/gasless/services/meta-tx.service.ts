import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SessionKeyService } from '../session-key/session-key.service';
import { GasBudgetService } from '../gas-budget/gas-budget.service';
import { NonceService } from '../nonce/nonce.service';
import { RelayerService } from '../relayer/relayer.service';

import { GaslessTransaction } from './gasless-transaction.entity';
import { TxStatus } from './tx-status.enum';

@Injectable()
export class MetaTxService {
  constructor(
    private readonly sessionKeyService: SessionKeyService,
    private readonly gasBudgetService: GasBudgetService,
    private readonly nonceService: NonceService,
    private readonly relayer: RelayerService,

    @InjectRepository(GaslessTransaction)
    private readonly repo: Repository<GaslessTransaction>,
  ) {}

  async submit(userId: string, publicKey: string, xdr: string) {
    const validKey = await this.sessionKeyService.validate(userId, publicKey);
    if (!validKey) throw new Error('Invalid session key');

    const canSpend = await this.gasBudgetService.canSpend(userId, 100);
    if (!canSpend) throw new Error('Gas budget exceeded');

    const nonce = this.nonceService.getNext(userId);

    const record = this.repo.create({ userId, to: publicKey, xdr, nonce });
    await this.repo.save(record);

    try {
      const hash = await this.relayer.relay(xdr);
      record.status = TxStatus.SUCCESS;
      record.txHash = hash;

      await this.gasBudgetService.spend(userId, 100);
    } catch (e) {
      record.status = TxStatus.FAILED;
    }

    await this.repo.save(record);
    return record;
  }
}
