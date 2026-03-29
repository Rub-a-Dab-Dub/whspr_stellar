import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { ModerationAction } from '../entities/moderation-result.entity';

export class OverrideModerationDto {
  @ApiProperty({ enum: ModerationAction })
  @IsEnum(ModerationAction)
  action!: ModerationAction;

  @ApiProperty()
  @IsBoolean()
  flagged!: boolean;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
