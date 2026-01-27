import { IsEnum, IsUUID } from 'class-validator';
import { MemberRole } from '../entities/room-member.entity';

export class SetRoomRoleDto {
    @IsUUID()
    userId: string;

    @IsEnum(MemberRole)
    role: MemberRole;
}
