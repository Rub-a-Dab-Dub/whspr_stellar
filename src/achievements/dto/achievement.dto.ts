import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AchievementType,
  AchievementRarity,
} from '../entities/achievement.entity';

export class CreateAchievementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: AchievementType })
  @IsEnum(AchievementType)
  type: AchievementType;

  @ApiProperty()
  @IsObject()
  criteria: {
    type: string;
    target?: number;
    condition?: string;
    [key: string]: any;
  };

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ enum: AchievementRarity })
  @IsEnum(AchievementRarity)
  @IsOptional()
  rarity?: AchievementRarity;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  xpBonus?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;
}

export class UpdateAchievementDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  criteria?: {
    type: string;
    target?: number;
    condition?: string;
    [key: string]: any;
  };

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ enum: AchievementRarity })
  @IsEnum(AchievementRarity)
  @IsOptional()
  rarity?: AchievementRarity;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  xpBonus?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;
}

export class AchievementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: AchievementType })
  type: AchievementType;

  @ApiProperty()
  criteria: object;

  @ApiProperty()
  icon: string;

  @ApiProperty({ enum: AchievementRarity })
  rarity: AchievementRarity;

  @ApiProperty()
  xpBonus: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isHidden: boolean;
}

export class UserAchievementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: () => AchievementResponseDto })
  achievement: AchievementResponseDto;

  @ApiProperty()
  progress: number;

  @ApiProperty()
  currentValue: number;

  @ApiProperty()
  targetValue: number;

  @ApiProperty()
  isUnlocked: boolean;

  @ApiProperty()
  unlockedAt: Date;

  @ApiProperty()
  createdAt: Date;
}

export class AchievementProgressDto {
  @ApiProperty()
  achievementId: string;

  @ApiProperty()
  achievementName: string;

  @ApiProperty()
  progress: number;

  @ApiProperty()
  currentValue: number;

  @ApiProperty()
  targetValue: number;

  @ApiProperty()
  isUnlocked: boolean;
}
