import { SetMetadata } from '@nestjs/common';
import { MemberPermission } from '../constants/room-member.constants';

export const RequirePermission = (permission: MemberPermission) =>
  SetMetadata('requiredPermission', permission);
