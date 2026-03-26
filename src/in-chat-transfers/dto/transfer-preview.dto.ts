import { ApiProperty } from '@nestjs/swagger';

export class TransferPreviewDto {
  @ApiProperty()
  transferId!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty({ type: [String] })
  recipients!: string[];

  @ApiProperty()
  asset!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty()
  amountPerRecipient!: string;

  @ApiProperty()
  feeEstimate!: string;

  @ApiProperty()
  totalCost!: string;

  @ApiProperty()
  status!: string;
}
