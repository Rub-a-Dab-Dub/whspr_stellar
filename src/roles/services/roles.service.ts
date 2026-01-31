// src/roles/services/roles.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RoleType } from '../entities/role.entity';
import { User } from '../../user/entities/user.entity';
import { RoleRepository } from '../repositories/role.repository';
import { AuditLogService } from '../../admin/services/audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../../admin/entities/audit-log.entity';
import { Request } from 'express';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private roleRepository: RoleRepository,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async assignRoleToUser(
    userId: string,
    roleName: RoleType,
    actorUserId?: string,
    req?: Request,
  ): Promise<User> {
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
    const savedUser = await this.userRepository.save(user);

    try {
      await this.auditLogService.createAuditLog({
        actorUserId: actorUserId || null,
        targetUserId: userId,
        action: AuditAction.ROLE_ASSIGNED,
        eventType: AuditEventType.ADMIN,
        outcome: AuditOutcome.SUCCESS,
        severity: AuditSeverity.MEDIUM,
        details: `Assigned role ${roleName}`,
        metadata: { roleName },
        req,
      });
    } catch (error) {
      this.logger.warn(`Failed to audit role assignment: ${error.message}`);
    }

    return savedUser;
  }

  async revokeRoleFromUser(
    userId: string,
    roleName: RoleType,
    actorUserId?: string,
    req?: Request,
  ): Promise<User> {
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
    const savedUser = await this.userRepository.save(user);

    try {
      await this.auditLogService.createAuditLog({
        actorUserId: actorUserId || null,
        targetUserId: userId,
        action: AuditAction.ROLE_REVOKED,
        eventType: AuditEventType.ADMIN,
        outcome: AuditOutcome.SUCCESS,
        severity: AuditSeverity.MEDIUM,
        details: `Revoked role ${roleName}`,
        metadata: { roleName },
        req,
      });
    } catch (error) {
      this.logger.warn(`Failed to audit role revoke: ${error.message}`);
    }

    return savedUser;
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
