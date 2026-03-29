import { ApiProperty } from '@nestjs/swagger';
import { StakeholderDistribution } from '../revenue.types';

export class DistributionHistoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  period: string;

  @ApiProperty()
  totalCollected: string;

  @ApiProperty()
  platformShare: string;

  @ApiProperty({ type: [StakeholderDistribution] })
  stakeholderDistributions: StakeholderDistribution[];

  @ApiProperty()
  distributedAt?: Date;

  @ApiProperty()
  txHash?: string;
}

