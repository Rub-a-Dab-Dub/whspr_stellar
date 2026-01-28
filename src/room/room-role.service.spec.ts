import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { RoomRoleService } from './services/room-role.service';
import { RoomMember, MemberRole } from './entities/room-member.entity';
import { RoomBan } from './entities/room-ban.entity';
import { RoomWhitelist } from './entities/room-whitelist.entity';
import { RoomEmergencyPause, EmergencyPauseReason } from './entities/room-emergency-pause.entity';
import { Room } from './entities/room.entity';
import { User } from '../user/entities/user.entity';
import { CacheService } from '../cache/cache.service';
import { MemberPermission, ROLE_PERMISSIONS } from './constants/room-member.constants';

describe('RoomRoleService', () => {
    let service: RoomRoleService;
    let mockRoomMemberRepository: any;
    let mockRoomBanRepository: any;
    let mockRoomWhitelistRepository: any;
    let mockEmergencyPauseRepository: any;
    let mockRoomRepository: any;
    let mockUserRepository: any;
    let mockCacheService: any;

    beforeEach(async () => {
        mockRoomMemberRepository = {
            findOne: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
        };

        mockRoomBanRepository = {
            findOne: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            create: jest.fn(),
        };

        mockRoomWhitelistRepository = {
            findOne: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            create: jest.fn(),
        };

        mockEmergencyPauseRepository = {
            findOne: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            create: jest.fn(),
        };

        mockRoomRepository = {
            findOne: jest.fn(),
        };

        mockUserRepository = {
            findOne: jest.fn(),
        };

        mockCacheService = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RoomRoleService,
                {
                    provide: getRepositoryToken(RoomMember),
                    useValue: mockRoomMemberRepository,
                },
                {
                    provide: getRepositoryToken(RoomBan),
                    useValue: mockRoomBanRepository,
                },
                {
                    provide: getRepositoryToken(RoomWhitelist),
                    useValue: mockRoomWhitelistRepository,
                },
                {
                    provide: getRepositoryToken(RoomEmergencyPause),
                    useValue: mockEmergencyPauseRepository,
                },
                {
                    provide: getRepositoryToken(Room),
                    useValue: mockRoomRepository,
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: CacheService,
                    useValue: mockCacheService,
                },
            ],
        }).compile();

        service = module.get<RoomRoleService>(RoomRoleService);
    });

    describe('setRoomRole', () => {
        it('should set user role in room', async () => {
            const roomId = 'room-1';
            const userId = 'user-1';
            const initiatorId = 'admin-1';
            const newRole = MemberRole.MODERATOR;

            const member = {
                id: 'member-1',
                roomId,
                userId,
                role: MemberRole.MEMBER,
                permissions: ROLE_PERMISSIONS[MemberRole.MEMBER],
            };

            const initiatorMember = {
                id: 'member-admin',
                roomId,
                userId: initiatorId,
                role: MemberRole.ADMIN,
                permissions: ROLE_PERMISSIONS[MemberRole.ADMIN],
            };

            const room = { id: roomId, ownerId: 'owner-1' };

            mockRoomMemberRepository.findOne
                .mockResolvedValueOnce(initiatorMember)
                .mockResolvedValueOnce(member)
                .mockResolvedValueOnce(initiatorMember);
            mockRoomRepository.findOne.mockResolvedValue(room);
            mockRoomMemberRepository.save.mockResolvedValue({
                ...member,
                role: newRole,
                permissions: ROLE_PERMISSIONS[newRole],
            });

            const result = await service.setRoomRole(
                roomId,
                userId,
                newRole,
                initiatorId,
            );

            expect(result.role).toBe(newRole);
            expect(mockCacheService.del).toHaveBeenCalled();
        });

        it('should throw ForbiddenException if initiator lacks permission', async () => {
            const roomId = 'room-1';
            const userId = 'user-1';
            const initiatorId = 'member-1';

            const initiatorMember = {
                id: 'member-1',
                roomId,
                userId: initiatorId,
                role: MemberRole.MEMBER,
                permissions: ROLE_PERMISSIONS[MemberRole.MEMBER],
            };

            mockRoomMemberRepository.findOne.mockResolvedValue(initiatorMember);

            await expect(
                service.setRoomRole(roomId, userId, MemberRole.MODERATOR, initiatorId),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('banUser', () => {
        it('should ban user from room', async () => {
            const roomId = 'room-1';
            const userId = 'user-1';
            const initiatorId = 'admin-1';
            const reason = 'Spam';

            const initiatorMember = {
                id: 'member-admin',
                roomId,
                userId: initiatorId,
                role: MemberRole.ADMIN,
                permissions: ROLE_PERMISSIONS[MemberRole.ADMIN],
            };

            const ban = {
                id: 'ban-1',
                roomId,
                userId,
                bannedBy: initiatorId,
                reason,
                expiresAt: null,
            };

            mockRoomMemberRepository.findOne.mockResolvedValue(initiatorMember);
            mockRoomBanRepository.create.mockReturnValue(ban);
            mockRoomBanRepository.save.mockResolvedValue(ban);
            mockRoomMemberRepository.delete.mockResolvedValue({ affected: 1 });

            const result = await service.banUser(
                roomId,
                userId,
                reason,
                initiatorId,
            );

            expect(result.userId).toBe(userId);
            expect(result.reason).toBe(reason);
            expect(mockRoomMemberRepository.delete).toHaveBeenCalledWith({
                roomId,
                userId,
            });
        });

        it('should throw BadRequestException if user already banned', async () => {
            const roomId = 'room-1';
            const userId = 'user-1';
            const initiatorId = 'admin-1';

            const initiatorMember = {
                id: 'member-admin',
                roomId,
                userId: initiatorId,
                role: MemberRole.ADMIN,
                permissions: ROLE_PERMISSIONS[MemberRole.ADMIN],
            };

            const existingBan = {
                id: 'ban-1',
                roomId,
                userId,
                expiresAt: null,
                isExpired: false,
            };

            mockRoomMemberRepository.findOne.mockResolvedValue(initiatorMember);
            mockRoomBanRepository.findOne.mockResolvedValue(existingBan);

            await expect(
                service.banUser(roomId, userId, 'Spam', initiatorId),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('isUserBanned', () => {
        it('should return true if user is banned', async () => {
            const roomId = 'room-1';
            const userId = 'user-1';

            const ban = {
                id: 'ban-1',
                roomId,
                userId,
                expiresAt: null,
                isExpired: false,
            };

            mockCacheService.get.mockResolvedValue(null);
            mockRoomBanRepository.findOne.mockResolvedValue(ban);
            mockCacheService.set.mockResolvedValue(undefined);

            const result = await service.isUserBanned(roomId, userId);

            expect(result).toBe(true);
            expect(mockCacheService.set).toHaveBeenCalled();
        });

        it('should return false if user is not banned', async () => {
            const roomId = 'room-1';
            const userId = 'user-1';

            mockCacheService.get.mockResolvedValue(null);
            mockRoomBanRepository.findOne.mockResolvedValue(undefined);
            mockCacheService.set.mockResolvedValue(undefined);

            const result = await service.isUserBanned(roomId, userId);

            expect(result).toBe(false);
            expect(mockCacheService.set).toHaveBeenCalledWith(
                `room:ban:${roomId}:${userId}`,
                'false',
                300,
            );
        });
    });

    describe('pauseRoom', () => {
        it('should pause room', async () => {
            const roomId = 'room-1';
            const initiatorId = 'admin-1';

            const initiatorMember = {
                id: 'member-admin',
                roomId,
                userId: initiatorId,
                role: MemberRole.ADMIN,
                permissions: ROLE_PERMISSIONS[MemberRole.ADMIN],
            };

            const pause = {
                id: 'pause-1',
                roomId,
                pausedBy: initiatorId,
                reason: EmergencyPauseReason.SPAM,
                isPaused: true,
            };

            mockRoomMemberRepository.findOne.mockResolvedValue(initiatorMember);
            mockEmergencyPauseRepository.findOne.mockResolvedValue(null);
            mockEmergencyPauseRepository.create.mockReturnValue(pause);
            mockEmergencyPauseRepository.save.mockResolvedValue(pause);
            mockCacheService.del.mockResolvedValue(undefined);

            const result = await service.pauseRoom(
                roomId,
                initiatorId,
                EmergencyPauseReason.SPAM,
            );

            expect(result.isPaused).toBe(true);
            expect(mockCacheService.del).toHaveBeenCalled();
        });
    });

    describe('verifyRoomAccess', () => {
        it('should allow access if user not banned and room not paused', async () => {
            const roomId = 'room-1';
            const userId = 'user-1';

            mockCacheService.get.mockResolvedValue(null);
            mockRoomBanRepository.findOne.mockResolvedValue(null);
            mockEmergencyPauseRepository.findOne.mockResolvedValue(null);
            mockRoomRepository.findOne.mockResolvedValue({ id: roomId, isPrivate: false });
            mockCacheService.set.mockResolvedValue(undefined);

            const result = await service.verifyRoomAccess(roomId, userId);

            expect(result.canAccess).toBe(true);
        });

        it('should deny access if user is banned', async () => {
            const roomId = 'room-1';
            const userId = 'user-1';

            const ban = {
                id: 'ban-1',
                roomId,
                userId,
                expiresAt: null,
                isExpired: false,
            };

            mockCacheService.get.mockResolvedValue(null);
            mockRoomBanRepository.findOne.mockResolvedValue(ban);
            mockCacheService.set.mockResolvedValue(undefined);

            const result = await service.verifyRoomAccess(roomId, userId);

            expect(result.canAccess).toBe(false);
            expect(result.reason).toContain('banned');
        });

        it('should deny access if room is paused', async () => {
            const roomId = 'room-1';
            const userId = 'user-1';

            const pause = {
                id: 'pause-1',
                roomId,
                isPaused: true,
            };

            mockCacheService.get.mockResolvedValue(null);
            mockRoomBanRepository.findOne.mockResolvedValue(null);
            mockEmergencyPauseRepository.findOne.mockResolvedValue(pause);
            mockCacheService.set.mockResolvedValue(undefined);

            const result = await service.verifyRoomAccess(roomId, userId);

            expect(result.canAccess).toBe(false);
            expect(result.reason).toContain('paused');
        });
    });
});
