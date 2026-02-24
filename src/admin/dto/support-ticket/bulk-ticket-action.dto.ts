import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '../../enums/ticket-priority.enum';
import { TicketStatus } from '../../enums/ticket-status.enum';

export enum BulkTicketAction {
  ASSIGN = 'assign',
  CLOSE = 'close',
  CHANGE_PRIORITY = 'change_priority',
  CHANGE_STATUS = 'change_status',
}

export class BulkTicketActionPayloadDto {
  @ApiPropertyOptional({ description: 'Admin user ID for assign action' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({ enum: TicketPriority, description: 'Priority for change_priority action' })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketStatus, description: 'Status for change_status action' })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}

export class BulkTicketActionDto {
  @ApiProperty({
    type: [String],
    description: 'Support ticket IDs (max 50)',
    maxItems: 50,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  ticketIds: string[];

  @ApiProperty({ enum: BulkTicketAction })
  @IsEnum(BulkTicketAction)
  action: BulkTicketAction;

  @ApiPropertyOptional({
    description: 'Action payload; required fields depend on the action type',
    type: BulkTicketActionPayloadDto,
  })
  @IsOptional()
  @IsObject()
  payload?: BulkTicketActionPayloadDto;
}
