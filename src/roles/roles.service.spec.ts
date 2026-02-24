import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './services/roles.service';
import { RoleRepository } from './repositories/role.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { AuditLogService } from '../admin/services/audit-log.service';

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: RoleRepository, useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: AuditLogService, useValue: {} },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
