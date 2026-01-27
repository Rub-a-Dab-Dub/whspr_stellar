import { IsEnum, IsString, IsOptional } from 'class-validator';
import { EmergencyPauseReason } from '../entities/room-emergency-pause.entity';

export class EmergencyPauseDto {
    @IsEnum(EmergencyPauseReason)
    reason: EmergencyPauseReason;

    @IsOptional()
    @IsString()
    description?: string;
}
