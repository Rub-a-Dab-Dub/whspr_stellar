import { registerAs } from '@nestjs/config';

export default registerAs('stellar', () => ({
  rpcUrl: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  contractId: process.env.WHSPR_CONTRACT_ID,
  startLedger: parseInt(process.env.STELLAR_START_LEDGER, 10) || 0,
  pollIntervalMs: parseInt(process.env.STELLAR_POLL_INTERVAL_MS, 10) || 5000,
  requiredConfirmations: parseInt(process.env.STELLAR_REQUIRED_CONFIRMATIONS, 10) || 12,
}));
