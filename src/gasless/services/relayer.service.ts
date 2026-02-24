import { Injectable } from '@nestjs/common';
import * as StellarSdk from 'stellar-sdk';

@Injectable()
export class RelayerService {
  private server = new StellarSdk.Server(process.env.STELLAR_RPC);
  private relayerKeypair = StellarSdk.Keypair.fromSecret(
    process.env.RELAYER_SECRET,
  );

  async relay(xdr: string): Promise<string> {
    const tx = new StellarSdk.Transaction(xdr, StellarSdk.Networks.PUBLIC);

    tx.sign(this.relayerKeypair);

    const res = await this.server.submitTransaction(tx);
    return res.hash;
  }
}
