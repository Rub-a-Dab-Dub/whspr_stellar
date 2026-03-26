export class FeeBreakdown {
  networkFee: number;
  platformFee: number;
}

export class FeeEstimateResponseDto {
  total: number;
  breakdown: FeeBreakdown;
}
