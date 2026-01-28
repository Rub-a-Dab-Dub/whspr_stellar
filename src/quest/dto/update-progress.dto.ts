export class UpdateProgressDto {
  @IsString()
  questId: string;

  @IsNumber()
  @Min(0)
  progressIncrement: number;
}