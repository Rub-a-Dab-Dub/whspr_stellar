// src/roles/roles.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { User } from '../user/entities/user.entity';
import { RolesService } from './services/roles.service';
import { PermissionService } from './services/permission.service';
import { RoleRepository } from './repositories/role.repository';
import { RoleGuard } from './guards/role.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RolesController } from './roles.controller';
import { RolesSeederService } from 'src/database/seeders/roles.seeder';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, User]), AdminModule],
  providers: [
    RolesService,
    PermissionService,
    RoleRepository,
    RoleGuard,
    PermissionGuard,
    RolesSeederService,
  ],
  controllers: [RolesController],
  exports: [
    RolesService,
    PermissionService,
    RoleGuard,
    PermissionGuard,
    RolesSeederService,
  ],
})
export class RolesModule {}
