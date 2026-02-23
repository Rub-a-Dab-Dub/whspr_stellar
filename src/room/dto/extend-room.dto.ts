import { IsInt, Min, Max } from 'class-validator';

export class ExtendRoomDto {
  @IsInt()
  @Min(60)
  @Max(43200) // Max 30 days
  additionalMinutes: number;
}
