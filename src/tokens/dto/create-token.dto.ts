import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsUrl,
  IsEnum,
  Length,
  Min,
  Max,
} from 'class-validator';
import { TokenNetwork } from '../entities/token.entity';

export class CreateTokenDto {
  @IsString()
  @Length(1, 56)
  address!: string;

  @IsString()
  @Length(1, 20)
  symbol!: string;

  @IsString()
  @Length(1, 100)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(18)
  @IsOptional()
  decimals?: number;

  @IsUrl()
  @IsOptional()
  logoUrl?: string;

  @IsEnum(TokenNetwork)
  @IsOptional()
  network?: TokenNetwork;

  @IsBoolean()
  @IsOptional()
  isNative?: boolean;

  @IsString()
  @IsOptional()
  coingeckoId?: string;
}
