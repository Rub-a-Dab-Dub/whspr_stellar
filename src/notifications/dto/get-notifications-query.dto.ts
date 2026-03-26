import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { InAppNotificationType } from '../entities/notification.entity';

export class GetNotificationsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InAppNotificationType })
  @IsOptional()
  @IsEnum(InAppNotificationType)
  type?: InAppNotificationType;
}
