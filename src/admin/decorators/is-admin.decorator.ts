import { applyDecorators, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '../guards/is-admin.guard';

export function IsAdmin() {
  return applyDecorators(UseGuards(IsAdminGuard));
}
