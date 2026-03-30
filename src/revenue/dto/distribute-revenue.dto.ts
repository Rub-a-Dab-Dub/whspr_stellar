import { ApiProperty } from '@nestjs/swagger';

export class DistributeRevenueDto {
  @ApiProperty()
  period: string; // YYYY-MM-DD
  
  @ApiProperty({ required: false })
  splits?: {
    treasury?: number;
    referralPool?: number;
    stakingRewards?: number;
  };
}

