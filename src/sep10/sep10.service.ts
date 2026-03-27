import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as StellarSdk from '@stellar/stellar-sdk';

const CHALLENGE_EXPIRY_SECONDS = 300; // 5 minutes

@Injectable()
export class Sep10Service {
  private readonly logger = new Logger(Sep10Service.name);
  private readonly serverKeypair: StellarSdk.Keypair;
  private readonly networkPassphrase: string;
  private readonly homeDomain: string;
  private readonly webAuthEndpoint: string;

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    const privateKey = this.config.get<string>('SEP10_SERVER_SECRET');
    if (!privateKey) {
      throw new Error('SEP10_SERVER_SECRET is required');
    }
    this.serverKeypair = StellarSdk.Keypair.fromSecret(privateKey);
    this.networkPassphrase =
      this.config.get<string>('SOROBAN_NETWORK_PASSPHRASE') ??
      StellarSdk.Networks.TESTNET;
    this.homeDomain = this.config.get<string>('SEP10_HOME_DOMAIN') ?? 'localhost';
    this.webAuthEndpoint =
      this.config.get<string>('SEP10_WEB_AUTH_ENDPOINT') ??
      `https://${this.homeDomain}/auth`;
  }

  /** Returns the server's public key (for stellar.toml) */
  get serverPublicKey(): string {
    return this.serverKeypair.publicKey();
  }

  get tomlHomeDomain(): string {
    return this.homeDomain;
  }

  get tomlWebAuthEndpoint(): string {
    return this.webAuthEndpoint;
  }

  /**
   * Build a SEP-10 challenge transaction for the given account.
   * Returns the XDR-encoded transaction envelope.
   */
  buildChallenge(account: string): string {
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(account)) {
      throw new BadRequestException('Invalid Stellar account address');
    }

    const now = Math.floor(Date.now() / 1000);
    const memo = StellarSdk.Memo.none();

    // SEP-10 requires sequence 0 for the source account
    const sourceAccount = new StellarSdk.Account(this.serverKeypair.publicKey(), '-1');

    const randomNonce = StellarSdk.Keypair.random().publicKey(); // 32-byte random value encoded as G-address

    const manageDataOp = StellarSdk.Operation.manageData({
      name: `${this.homeDomain} auth`,
      value: Buffer.from(randomNonce),
      source: account,
    });

    const webAuthDomainOp = StellarSdk.Operation.manageData({
      name: 'web_auth_domain',
      value: Buffer.from(this.homeDomain),
      source: this.serverKeypair.publicKey(),
    });

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
      memo,
      timebounds: {
        minTime: now,
        maxTime: now + CHALLENGE_EXPIRY_SECONDS,
      },
    })
      .addOperation(manageDataOp)
      .addOperation(webAuthDomainOp)
      .build();

    tx.sign(this.serverKeypair);

    return tx.toEnvelope().toXDR('base64');
  }

  /**
   * Verify a signed SEP-10 challenge transaction and return a JWT.
   * @param transactionXdr - Base64-encoded signed transaction envelope
   * @param account - The client's Stellar account address
   */
  verifyChallenge(transactionXdr: string, account: string): string {
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(account)) {
      throw new BadRequestException('Invalid Stellar account address');
    }

    let tx: StellarSdk.Transaction;
    try {
      const envelope = StellarSdk.xdr.TransactionEnvelope.fromXDR(transactionXdr, 'base64');
      tx = new StellarSdk.Transaction(envelope, this.networkPassphrase);
    } catch {
      throw new BadRequestException('Invalid transaction XDR');
    }

    // 1. Verify server signature
    const txHash = tx.hash();
    const serverSigned = tx.signatures.some((sig) => {
      try {
        return this.serverKeypair.verify(txHash, sig.signature());
      } catch {
        return false;
      }
    });

    if (!serverSigned) {
      throw new UnauthorizedException('Transaction not signed by server');
    }

    // 2. Verify time bounds (challenge not expired)
    const now = Math.floor(Date.now() / 1000);
    const timeBounds = tx.timeBounds;
    if (!timeBounds) {
      throw new UnauthorizedException('Transaction missing time bounds');
    }
    if (now > Number(timeBounds.maxTime)) {
      throw new UnauthorizedException('Challenge has expired');
    }
    if (now < Number(timeBounds.minTime)) {
      throw new UnauthorizedException('Challenge not yet valid');
    }

    // 3. Verify first operation is manageData with correct source
    const ops = tx.operations;
    if (!ops.length || ops[0].type !== 'manageData') {
      throw new UnauthorizedException('Invalid challenge transaction structure');
    }
    const firstOp = ops[0] as StellarSdk.Operation.ManageData;
    if (firstOp.source !== account) {
      throw new UnauthorizedException('Challenge account mismatch');
    }
    if (firstOp.name !== `${this.homeDomain} auth`) {
      throw new UnauthorizedException('Invalid challenge operation name');
    }

    // 4. Verify client signature
    const clientKeypair = StellarSdk.Keypair.fromPublicKey(account);
    const clientSigned = tx.signatures.some((sig) => {
      try {
        return clientKeypair.verify(txHash, sig.signature());
      } catch {
        return false;
      }
    });

    if (!clientSigned) {
      throw new UnauthorizedException('Transaction not signed by client account');
    }

    // 5. Issue JWT
    const jwt = this.jwtService.sign(
      { sub: account },
      { expiresIn: '24h' },
    );

    this.logger.log(`SEP-10 auth successful for account: ${account}`);
    return jwt;
  }
}
