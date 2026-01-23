// src/roles/services/roles.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RoleType } from '../entities/role.entity';
import { User } from '../../user/entities/user.entity';
import { RoleRepository } from '../repositories/role.repository';

@Injectable()
export class RolesService {
  constructor(
    private roleRepository: RoleRepository,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async assignRoleToUser(userId: string, roleName: RoleType): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.roleRepository.findByName(roleName);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if user already has the role
    if (user.roles.some((r) => r.id === role.id)) {
      throw new BadRequestException('User already has this role');
    }

    user.roles.push(role);
    return this.userRepository.save(user);
  }

  async revokeRoleFromUser(userId: string, roleName: RoleType): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleIndex = user.roles.findIndex((r) => r.name === roleName);

    if (roleIndex === -1) {
      throw new BadRequestException('User does not have this role');
    }

    user.roles.splice(roleIndex, 1);
    return this.userRepository.save(user);
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    return this.roleRepository.getRolesByUserId(userId);
  }

  async getAllRoles(): Promise<Role[]> {
    return this.roleRepository.findAllWithPermissions();
  }

  async getRoleByName(name: RoleType): Promise<Role> {
    const role = await this.roleRepository.findByName(name);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }
}
