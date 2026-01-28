import { registerAs } from '@nestjs/config';

export default registerAs('evm', () => ({
  // Default RPC URL (backward-compatible, used as fallback for ethereum)
  rpcUrl: process.env.EVM_RPC_URL,
  privateKey: process.env.EVM_PRIVATE_KEY,

  // Per-chain RPC URLs
  chains: {
    ethereum: {
      rpcUrl: process.env.CHAIN_ETHEREUM_RPC_URL || process.env.EVM_RPC_URL,
      contractAddress: process.env.CHAIN_ETHEREUM_CONTRACT_ADDRESS || process.env.GGPAY_CONTRACT_ADDRESS,
    },
    bnb: {
      rpcUrl: process.env.CHAIN_BNB_RPC_URL,
      contractAddress: process.env.CHAIN_BNB_CONTRACT_ADDRESS,
    },
    celo: {
      rpcUrl: process.env.CHAIN_CELO_RPC_URL,
      contractAddress: process.env.CHAIN_CELO_CONTRACT_ADDRESS,
    },
    base: {
      rpcUrl: process.env.CHAIN_BASE_RPC_URL,
      contractAddress: process.env.CHAIN_BASE_CONTRACT_ADDRESS,
    },
  },
}));
