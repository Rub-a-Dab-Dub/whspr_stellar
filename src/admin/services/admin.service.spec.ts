import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { User } from '../../user/entities/user.entity';
import { Room } from '../../room/entities/room.entity';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';
import { Session } from '../../sessions/entities/session.entity';
import { RoomMember } from '../../room/entities/room-member.entity';
import { Transfer } from '../../transfer/entities/transfer.entity';
import { Message } from '../../message/entities/message.entity';
import { RoomPayment } from '../../room/entities/room-payment.entity';
import { PlatformConfig } from '../entities/platform-config.entity';
import { TransferBalanceService } from '../../transfer/services/transfer-balance.service';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from './audit-log.service';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { SessionService } from '../../sessions/sessions.service';
import { CacheService } from '../../cache/cache.service';
import { UserRole } from '../../roles/entities/role.entity';
import { UserFilterStatus } from '../dto/get-users.dto';

describe('AdminService', () => {
    let service: AdminService;
    let userRepository: Repository<User>;
    let roomRepository: Repository<Room>;
    let auditLogRepository: Repository<AuditLog>;

    const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
    };

    const mockRepository = {
        createQueryBuilder: jest.fn(() => mockQueryBuilder),
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        count: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdminService,
                { provide: getRepositoryToken(User), useValue: mockRepository },
                { provide: getRepositoryToken(Room), useValue: mockRepository },
                { provide: getRepositoryToken(AuditLog), useValue: mockRepository },
                { provide: getRepositoryToken(Session), useValue: mockRepository },
                { provide: getRepositoryToken(RoomMember), useValue: mockRepository },
                { provide: getRepositoryToken(Transfer), useValue: mockRepository },
                { provide: getRepositoryToken(Message), useValue: mockRepository },
                { provide: getRepositoryToken(RoomPayment), useValue: mockRepository },
                { provide: getRepositoryToken(PlatformConfig), useValue: mockRepository },
                { provide: TransferBalanceService, useValue: {} },
                { provide: RedisService, useValue: {} },
                { provide: AuditLogService, useValue: { createAuditLog: jest.fn() } },
                { provide: LeaderboardService, useValue: {} },
                { provide: SessionService, useValue: { revokeAllSessions: jest.fn() } },
                { provide: CacheService, useValue: {} },
            ],
        }).compile();

        service = module.get<AdminService>(AdminService);
        userRepository = module.get<Repository<User>>(getRepositoryToken(User));
        roomRepository = module.get<Repository<Room>>(getRepositoryToken(Room));
        auditLogRepository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getUsers', () => {
        it('should return paginated users with mapped fields', async () => {
            const mockUsers = [
                { id: '1', username: 'user1', email: 'user1@test.com', currentXp: 100, level: 1, createdAt: new Date(), updatedAt: new Date(), role: UserRole.USER },
            ];
            mockQueryBuilder.getManyAndCount.mockResolvedValue([mockUsers, 1]);
            mockQueryBuilder.getRawMany.mockResolvedValue([{ ownerId: '1', count: '5' }]);

            const result = await service.getUsers({ page: 1, limit: 10 }, 'admin-id');

            expect(result.users).toHaveLength(1);
            expect(result.users[0]).toMatchObject({
                id: '1',
                username: 'user1',
                roomsCreated: 5,
                status: 'active',
            });
            expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
            expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
        });

        it('should apply search filters correctly', async () => {
            mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
            mockQueryBuilder.getRawMany.mockResolvedValue([]);

            await service.getUsers({ search: 'test' }, 'admin-id');

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                expect.stringContaining('user.username ILIKE :search'),
                { search: '%test%' },
            );
        });

        it('should apply status filters for BANNED users', async () => {
            mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
            mockQueryBuilder.getRawMany.mockResolvedValue([]);

            await service.getUsers({ status: UserFilterStatus.BANNED }, 'admin-id');

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.isBanned = :isBanned', { isBanned: true });
        });
    });

    describe('getUserSessions', () => {
        it('should return user sessions', async () => {
            const mockSessions = [{ id: 's1', userId: 'u1' }];
            (mockRepository.find as jest.Mock).mockResolvedValue(mockSessions);

            const result = await service.getUserSessions('u1');

            expect(result).toEqual(mockSessions);
            expect(mockRepository.find).toHaveBeenCalledWith({
                where: { userId: 'u1' },
                order: { createdAt: 'DESC' },
            });
        });
    });

    describe('terminateSession', () => {
        it('should terminate a specific session', async () => {
            const mockSession = { id: 's1', userId: 'u1', isActive: true };
            (mockRepository.findOne as jest.Mock).mockResolvedValue(mockSession);

            await service.terminateSession('u1', 's1', 'admin-id');

            expect(mockSession.isActive).toBe(false);
            expect(mockRepository.save).toHaveBeenCalledWith(mockSession);
        });

        it('should throw NotFoundException if session not found', async () => {
            (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

            await expect(service.terminateSession('u1', 's1', 'admin-id')).rejects.toThrow(NotFoundException);
        });
    });
});
