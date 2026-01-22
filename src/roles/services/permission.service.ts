// src/roles/services/permission.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { RoleType } from '../entities/role.entity';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async userHasRole(userId: string, role: RoleType): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) return false;

    return user.roles.some((r) => r.name === role);
  }

  async userHasAnyRole(userId: string, roles: RoleType[]): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) return false;

    return user.roles.some((r) => roles.includes(r.name));
  }

  async userHasPermission(
    userId: string,
    permissionName: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) return false;

    const permissions = user.roles.flatMap((role) =>
      role.permissions.map((p) => p.name),
    );

    return permissions.includes(permissionName);
  }

  async userHasAllPermissions(
    userId: string,
    permissionNames: string[],
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) return false;

    const permissions = user.roles.flatMap((role) =>
      role.permissions.map((p) => p.name),
    );

    return permissionNames.every((perm) => permissions.includes(perm));
  }

  async userHasAnyPermission(
    userId: string,
    permissionNames: string[],
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) return false;

    const permissions = user.roles.flatMap((role) =>
      role.permissions.map((p) => p.name),
    );

    return permissionNames.some((perm) => permissions.includes(perm));
  }

  async getUserHighestHierarchy(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user || !user.roles.length) return 0;

    return Math.max(...user.roles.map((role) => role.hierarchy));
  }
}
