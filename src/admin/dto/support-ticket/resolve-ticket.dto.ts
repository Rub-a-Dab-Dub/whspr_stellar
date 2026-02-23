import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveTicketDto {
  @ApiProperty({ description: 'Resolution note describing how the issue was resolved' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  resolutionNote: string;
}
