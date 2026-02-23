import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTicketDto {
  @ApiProperty({ description: 'Admin user ID to assign the ticket to' })
  @IsUUID()
  adminId: string;
}
