import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../user/entities/user.entity';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.MODERATOR })
  @IsEnum(UserRole, {
    message: `role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role: UserRole;
}
