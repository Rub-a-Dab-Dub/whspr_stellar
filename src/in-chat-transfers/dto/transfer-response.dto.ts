import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferResponseDto {
  @ApiProperty()
  transferId!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  sorobanTxHash?: string | null;

  @ApiPropertyOptional()
  errorMessage?: string | null;

  @ApiPropertyOptional()
  messageId?: string | null;

  @ApiProperty()
  message!: string;
}
