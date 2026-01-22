import { registerAs } from '@nestjs/config';

export default registerAs('evm', () => ({
  rpcUrl: process.env.EVM_RPC_URL,
  privateKey: process.env.EVM_PRIVATE_KEY,
}));
