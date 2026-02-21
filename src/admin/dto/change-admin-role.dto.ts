import { IsEnum, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../roles/entities/role.entity';
import { AdminRole } from './invite-admin.dto';

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.SUPER_ADMIN];

export class ChangeAdminRoleDto {
    @ApiProperty({
        enum: ADMIN_ROLES,
        example: UserRole.MODERATOR,
        description: 'New role to assign',
    })
    @IsEnum(ADMIN_ROLES, {
        message: `role must be one of: ${ADMIN_ROLES.join(', ')}`,
    })
    role: AdminRole;

    @ApiProperty({
        example: 'Promoting to moderator for content review team',
        minLength: 3,
    })
    @IsString()
    @MinLength(3, { message: 'reason must be at least 3 characters' })
    reason: string;
}
