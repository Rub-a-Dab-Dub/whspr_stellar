import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TargetType } from '../entities/report.entity';

export class CreateReportDto {
  @IsEnum(TargetType)
  targetType: TargetType;

  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
