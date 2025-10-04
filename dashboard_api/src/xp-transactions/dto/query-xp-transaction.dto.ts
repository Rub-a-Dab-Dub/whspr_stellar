export class QueryXPTransactionDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ enum: ActionType, required: false })
  @IsOptional()
  @IsEnum(ActionType)
  actionType?: ActionType;

  @ApiProperty({ required: false, example: '2025-01-01' })
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false, example: '2025-12-31' })
  @IsOptional()
  endDate?: string;

  @ApiProperty({ required: false, example: 100, description: 'Minimum XP amount' })
  @IsOptional()
  @IsInt()
  minAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ required: false, enum: ['active', 'voided'], example: 'active' })
  @IsOptional()
  status?: string;
}