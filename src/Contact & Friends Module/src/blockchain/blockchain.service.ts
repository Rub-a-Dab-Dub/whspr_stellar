import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';

export interface OnChainBlockEvent {
  blockerId: string;
  targetId: string;
  isBlocked: boolean;
}

/**
 * Minimal ABI for the on-chain Contact contract.
 * Expects:
 *   function setBlock(address blocker, address target, bool blocked) external
 *   event BlockSet(address indexed blocker, address indexed target, bool blocked)
 */
const CONTACT_ABI = [
  'function setBlock(address blocker, address target, bool blocked) external',
  'event BlockSet(address indexed blocker, address indexed target, bool blocked)',
];

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private signer: ethers.Wallet | null = null;

  onModuleInit(): void {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const contractAddress = process.env.CONTACT_CONTRACT_ADDRESS;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

    if (!rpcUrl || !contractAddress || !privateKey) {
      this.logger.warn(
        'Blockchain env vars not set (BLOCKCHAIN_RPC_URL, CONTACT_CONTRACT_ADDRESS, BLOCKCHAIN_PRIVATE_KEY). ' +
          'On-chain sync is disabled.',
      );
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(contractAddress, CONTACT_ABI, this.signer);
      this.logger.log(`Blockchain connected: contract=${contractAddress}`);
    } catch (err) {
      this.logger.error('Failed to initialise blockchain provider', err);
    }
  }

  /**
   * Push a block/unblock action to the on-chain Contact contract.
   * No-ops gracefully when blockchain is not configured.
   */
  async syncBlock(blockerId: string, targetId: string, isBlocked: boolean): Promise<void> {
    if (!this.contract) return;

    try {
      // Convert UUID-based user IDs to deterministic addresses via keccak256
      const blockerAddr = this.uuidToAddress(blockerId);
      const targetAddr = this.uuidToAddress(targetId);

      const tx: ethers.TransactionResponse = await this.contract.setBlock(
        blockerAddr,
        targetAddr,
        isBlocked,
      );
      await tx.wait(1);
      this.logger.log(
        `[on-chain] setBlock tx=${tx.hash} blocker=${blockerId} target=${targetId} blocked=${isBlocked}`,
      );
    } catch (err) {
      this.logger.error(`[on-chain] syncBlock failed: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Fetch all BlockSet events from the contract for reconciliation.
   * Returns the latest state per (blocker, target) pair.
   */
  async fetchAllBlocks(): Promise<OnChainBlockEvent[]> {
    if (!this.contract || !this.provider) return [];

    try {
      const filter = this.contract.filters.BlockSet();
      const events = await this.contract.queryFilter(filter);

      // Deduplicate: keep only the latest event per (blocker, target) pair
      const latest = new Map<string, OnChainBlockEvent>();
      for (const raw of events) {
        const e = raw as ethers.EventLog;
        const [blockerAddr, targetAddr, isBlocked] = e.args as unknown as [string, string, boolean];
        const key = `${blockerAddr}:${targetAddr}`;
        latest.set(key, {
          blockerId: this.addressToUuid(blockerAddr),
          targetId: this.addressToUuid(targetAddr),
          isBlocked,
        });
      }

      return Array.from(latest.values());
    } catch (err) {
      this.logger.error(`[on-chain] fetchAllBlocks failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Deterministically derive an EVM address from a UUID string.
   * In production you'd store the user's actual wallet address instead.
   */
  private uuidToAddress(uuid: string): string {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(uuid));
    return ethers.getAddress('0x' + hash.slice(26)); // last 20 bytes
  }

  /**
   * Reverse map — only works if you maintain a uuid<->address registry.
   * This stub returns the address itself as a placeholder.
   * Replace with a real lookup against your users table.
   */
  private addressToUuid(address: string): string {
    return address; // TODO: look up userId by wallet address
  }
}
