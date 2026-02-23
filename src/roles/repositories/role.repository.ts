// src/roles/repositories/role.repository.ts
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Role, UserRole } from '../entities/role.entity';

@Injectable()
export class RoleRepository extends Repository<Role> {
  constructor(private dataSource: DataSource) {
    super(Role, dataSource.createEntityManager());
  }

  async findByName(name: UserRole): Promise<Role | null> {
    return this.findOne({
      where: { name },
      relations: ['permissions'],
    });
  }

  async findWithPermissions(id: string): Promise<Role | null> {
    return this.findOne({
      where: { id },
      relations: ['permissions'],
    });
  }

  async findAllWithPermissions(): Promise<Role[]> {
    return this.find({
      relations: ['permissions'],
      order: { hierarchy: 'DESC' },
    });
  }

  async findByHierarchy(minHierarchy: number): Promise<Role[]> {
    return this.createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('role.hierarchy >= :minHierarchy', { minHierarchy })
      .orderBy('role.hierarchy', 'DESC')
      .getMany();
  }

  async hasPermission(
    roleId: string,
    permissionName: string,
  ): Promise<boolean> {
    const role = await this.createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('role.id = :roleId', { roleId })
      .andWhere('permission.name = :permissionName', { permissionName })
      .getOne();

    return !!role;
  }

  async getRolesByUserId(userId: string): Promise<Role[]> {
    return this.createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .innerJoin('role.users', 'user')
      .where('user.id = :userId', { userId })
      .getMany();
  }
}
