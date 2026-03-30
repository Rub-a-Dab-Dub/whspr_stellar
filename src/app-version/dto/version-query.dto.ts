import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AppPlatform } from '../entities/app-version.entity';

export class VersionQueryDto {
  @ApiProperty({ enum: AppPlatform, example: AppPlatform.WEB })
  @IsEnum(AppPlatform)
  platform!: AppPlatform;
}
