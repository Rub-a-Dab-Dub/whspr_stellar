import { GatedContentType, GateType } from './entities/content-gate.entity';
import { WalletNetwork } from '../wallets/entities/wallet.entity';

export interface GateRequirementSummary {
  id: string;
  contentType: GatedContentType;
  contentId: string;
  gateType: GateType;
  gateToken: string;
  minBalance: string;
  network: WalletNetwork;
}
