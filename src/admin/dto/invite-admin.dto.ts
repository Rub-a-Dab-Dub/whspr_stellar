import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../roles/entities/role.entity';

export type AdminRole = UserRole.ADMIN | UserRole.MODERATOR | UserRole.SUPER_ADMIN;

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.SUPER_ADMIN];

export class InviteAdminDto {
    @ApiProperty({ example: 'newadmin@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        enum: ADMIN_ROLES,
        example: UserRole.ADMIN,
        description: 'Role to assign to the invited admin',
    })
    @IsEnum(ADMIN_ROLES, {
        message: `role must be one of: ${ADMIN_ROLES.join(', ')}`,
    })
    role: AdminRole;
}
