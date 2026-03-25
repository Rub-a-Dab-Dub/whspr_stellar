import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class QueryUserNFTsDto {
  @IsOptional()
  @IsString()
  collection?: string;

  @IsOptional()
  @IsString()
  contractAddress?: string;

  @IsOptional()
  @IsString()
  tokenId?: string;

  @IsOptional()
  @IsString()
  network?: string;

  @IsOptional()
  @IsBooleanString()
  refresh?: string;
}
