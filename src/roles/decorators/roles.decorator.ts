// src/roles/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { RoleType } from '../entities/role.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
