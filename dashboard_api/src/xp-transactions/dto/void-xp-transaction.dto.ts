export class VoidXPTransactionDto {
  @ApiProperty({ example: 'Detected farming exploit' })
  @IsString()
  voidReason: string;

  @ApiProperty({ example: 'admin-uuid' })
  @IsUUID()
  voidedBy: string;
}