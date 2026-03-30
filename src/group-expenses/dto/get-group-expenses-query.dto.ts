import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { GroupExpenseStatus } from '../entities/group-expense.entity';

export class GetGroupExpensesQueryDto {
  @ApiPropertyOptional({ enum: GroupExpenseStatus })
  @IsOptional()
  @IsEnum(GroupExpenseStatus)
  status?: GroupExpenseStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
