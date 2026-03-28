import { ApiProperty } from '@nestjs/swagger';

export class FeedbackStatsDto {
  @ApiProperty()
  byType: Record<string, number>;

  @ApiProperty()
  byStatus: Record<string, number>;

  @ApiProperty()
  byPriority: Record<string, number>;

  @ApiProperty()
  byVersion: Record<string, number>;

  @ApiProperty()
  total: number;

  @ApiProperty()
  highPriorityBugs: number;
}
