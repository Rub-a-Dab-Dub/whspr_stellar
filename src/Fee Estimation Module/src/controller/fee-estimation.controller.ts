import { Body, Controller, Post } from '@nestjs/common';
import { EstimateFeeDto } from '../dto/estimate-fee.dto';
import { FeeEstimationService } from '../service/fee-estimation.service';
import { FeeEstimateResponseDto } from '../dto/fee-estimate-response.dto';

@Controller('fees')
export class FeeEstimationController {
  constructor(private service: FeeEstimationService) {}

  @Post('estimate')
  async estimate(@Body() dto: EstimateFeeDto): Promise<FeeEstimateResponseDto> {
    const { operation, amount, userTier } = dto as any;
    switch (operation) {
      case 'transfer':
        return this.service.estimateTransferFee(amount, userTier);
      case 'tip':
        return this.service.estimateTipFee(amount, userTier);
      case 'split':
        return this.service.estimateSplitFee(amount, userTier);
      case 'treasury':
        return this.service.estimateTreasuryFee(amount, userTier);
      default:
        return this.service.estimateTransferFee(amount, userTier);
    }
  }
}
