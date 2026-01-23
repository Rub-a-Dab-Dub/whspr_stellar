// src/database/seeders/roles.seeder.ts
import { DataSource } from 'typeorm';
import { Role, RoleType } from '../../roles/entities/role.entity';
import { Permission } from '../../roles/entities/permission.entity';

export async function seedRolesAndPermissions(dataSource: DataSource) {
  const permissionRepository = dataSource.getRepository(Permission);
  const roleRepository = dataSource.getRepository(Role);

  // Define permissions
  const permissionsData = [
    // User permissions
    {
      name: 'user.read',
      description: 'Read user information',
      resource: 'user',
      action: 'read',
    },
    {
      name: 'user.update',
      description: 'Update user information',
      resource: 'user',
      action: 'update',
    },
    {
      name: 'user.delete',
      description: 'Delete users',
      resource: 'user',
      action: 'delete',
    },
    {
      name: 'user.manage',
      description: 'Manage all users',
      resource: 'user',
      action: 'manage',
    },

    // Post permissions
    {
      name: 'post.create',
      description: 'Create posts',
      resource: 'post',
      action: 'create',
    },
    {
      name: 'post.read',
      description: 'Read posts',
      resource: 'post',
      action: 'read',
    },
    {
      name: 'post.update',
      description: 'Update own posts',
      resource: 'post',
      action: 'update',
    },
    {
      name: 'post.delete',
      description: 'Delete own posts',
      resource: 'post',
      action: 'delete',
    },
    {
      name: 'post.manage',
      description: 'Manage all posts',
      resource: 'post',
      action: 'manage',
    },

    // Comment permissions
    {
      name: 'comment.create',
      description: 'Create comments',
      resource: 'comment',
      action: 'create',
    },
    {
      name: 'comment.read',
      description: 'Read comments',
      resource: 'comment',
      action: 'read',
    },
    {
      name: 'comment.update',
      description: 'Update own comments',
      resource: 'comment',
      action: 'update',
    },
    {
      name: 'comment.delete',
      description: 'Delete own comments',
      resource: 'comment',
      action: 'delete',
    },
    {
      name: 'comment.manage',
      description: 'Manage all comments',
      resource: 'comment',
      action: 'manage',
    },

    // Role permissions
    {
      name: 'role.assign',
      description: 'Assign roles to users',
      resource: 'role',
      action: 'assign',
    },
    {
      name: 'role.manage',
      description: 'Manage roles and permissions',
      resource: 'role',
      action: 'manage',
    },
  ];

  // Create permissions
  const permissions = [];
  for (const permData of permissionsData) {
    let permission = await permissionRepository.findOne({
      where: { name: permData.name },
    });
    if (!permission) {
      permission = permissionRepository.create(permData);
      await permissionRepository.save(permission);
    }
    permissions.push(permission);
  }

  // Helper to get permissions by names
  const getPermissions = (names: string[]) =>
    permissions.filter((p) => names.includes(p.name));

  // Define roles with their permissions and hierarchy
  const rolesData = [
    {
      name: RoleType.ADMIN,
      description: 'Full system access',
      hierarchy: 100,
      permissions: permissions, // All permissions
    },
    {
      name: RoleType.MODERATOR,
      description: 'Can moderate content and users',
      hierarchy: 50,
      permissions: getPermissions([
        'user.read',
        'post.read',
        'post.manage',
        'comment.read',
        'comment.manage',
      ]),
    },
    {
      name: RoleType.CREATOR,
      description: 'Can create and manage own content',
      hierarchy: 20,
      permissions: getPermissions([
        'user.read',
        'user.update',
        'post.create',
        'post.read',
        'post.update',
        'post.delete',
        'comment.create',
        'comment.read',
        'comment.update',
        'comment.delete',
      ]),
    },
    {
      name: RoleType.USER,
      description: 'Basic user access',
      hierarchy: 10,
      permissions: getPermissions([
        'user.read',
        'user.update',
        'post.read',
        'comment.create',
        'comment.read',
        'comment.update',
        'comment.delete',
      ]),
    },
  ];

  // Create roles
  for (const roleData of rolesData) {
    let role = await roleRepository.findOne({ where: { name: roleData.name } });
    if (!role) {
      role = roleRepository.create({
        name: roleData.name,
        description: roleData.description,
        hierarchy: roleData.hierarchy,
        permissions: roleData.permissions,
      });
      await roleRepository.save(role);
      console.log(`Created role: ${role.name}`);
    } else {
      // Update permissions if role exists
      role.permissions = roleData.permissions;
      role.hierarchy = roleData.hierarchy;
      await roleRepository.save(role);
      console.log(`Updated role: ${role.name}`);
    }
  }

  console.log('Roles and permissions seeded successfully!');
}

// Alternative: Create a service to run the seeder
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class RolesSeederService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async seed() {
    await seedRolesAndPermissions(this.dataSource);
  }
}
