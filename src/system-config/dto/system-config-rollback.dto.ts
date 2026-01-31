import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class SystemConfigRollbackDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsInt()
  @Min(1)
  version: number;
}
