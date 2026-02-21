import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AdminController } from '../src/admin/controllers/admin.controller';
import { AdminService } from '../src/admin/services/admin.service';
import { IsModeratorGuard } from '../src/admin/guards/is-moderator.guard';
import { UserRole } from '../src/roles/entities/role.entity';
import { PlatformWalletService } from '../src/admin/services/platform-wallet.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RoleGuard } from '../src/roles/guards/role.guard';
import { PermissionGuard } from '../src/roles/guards/permission.guard';

describe('AdminController (e2e)', () => {
    let app: INestApplication;
    const mockAdminService = {
        getUsers: jest.fn(),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [AdminController],
            providers: [
                { provide: AdminService, useValue: mockAdminService },
                { provide: PlatformWalletService, useValue: {} },
            ],
        })
            .overrideGuard(IsModeratorGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RoleGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(PermissionGuard)
            .useValue({ canActivate: () => true })
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ transform: true }));
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('GET /admin/users', () => {
        it('should return 200 and user data', async () => {
            const mockResult = {
                users: [{ id: '1', username: 'testuser' }],
                total: 1,
                page: 1,
                limit: 10,
            };
            mockAdminService.getUsers.mockResolvedValue(mockResult);

            const response = await request(app.getHttpServer())
                .get('/admin/users')
                .query({ page: 1, limit: 10 })
                .expect(200);

            expect(response.body).toEqual(mockResult);
            expect(mockAdminService.getUsers).toHaveBeenCalled();
        });

        it('should return 400 for invalid query parameters', async () => {
            await request(app.getHttpServer())
                .get('/admin/users')
                .query({ page: 'abc' }) // invalid number
                .expect(400);
        });
    });
});
