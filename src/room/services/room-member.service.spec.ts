import { Test, TestingModule } from '@nestjs/testing';
import { RoomMemberService } from './room-member.service';
import { RoomMemberRepository } from '../repositories/room-member.repository';
import { RedisService } from '../../redis/redis.service';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { MemberRole, MemberStatus } from '../entities/room-member.entity';

describe('RoomMemberService', () => {
  let service: RoomMemberService;
  let memberRepository: jest.Mocked<RoomMemberRepository>;
  let redisService: jest.Mocked<RedisService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUser = { id: 'user-1', username: 'testuser' };
  const mockRoom = { id: 'room-1', name: 'Test Room', maxMembers: 100 };
  const mockMember = {
    id: 'member-1',
    roomId: 'room-1',
    userId: 'user-1',
    role: MemberRole.MEMBER,
    status: MemberStatus.ACTIVE,
    joinedAt: new Date(),
    permissions: ['SEND_MESSAGE'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomMemberService,
        {
          provide: RoomMemberRepository,
          useValue: {
            findMemberWithRole: jest.fn(),
            countMembers: jest.fn(),
            findByInviteToken: jest.fn(),
            isMember: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAdmins: jest.fn(),
          },
        },
        {
          provide: 'UserRepository',
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: 'RoomRepository',
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RoomMemberService>(RoomMemberService);
    memberRepository = module.get(RoomMemberRepository) as jest.Mocked<RoomMemberRepository>;
    redisService = module.get(RedisService) as jest.Mocked<RedisService>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  describe('joinRoom', () => {
    it('should join a user to a room', async () => {
      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          save: jest.fn().mockResolvedValue(mockMember),
        },
      };

      dataSource.createQueryRunner.mockReturnValue(queryRunner as any);
      memberRepository.findMemberWithRole.mockResolvedValue(null);
      memberRepository.countMembers.mockResolvedValue(5);
      redisService.delete.mockResolvedValue(true);

      const result = await service.joinRoom('user-1', 'room-1');

      expect(result).toBeDefined();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw error if user is already member', async () => {
      memberRepository.findMemberWithRole.mockResolvedValue(mockMember as any);

      await expect(service.joinRoom('user-1', 'room-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if max members reached', async () => {
      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      dataSource.createQueryRunner.mockReturnValue(queryRunner as any);
      memberRepository.findMemberWithRole.mockResolvedValue(null);
      memberRepository.countMembers.mockResolvedValue(100);

      await expect(service.joinRoom('user-1', 'room-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('leaveRoom', () => {
    it('should leave a room', async () => {
      memberRepository.findMemberWithRole.mockResolvedValue(mockMember as any);
      memberRepository.save.mockResolvedValue(mockMember as any);
      redisService.delete.mockResolvedValue(true);

      await service.leaveRoom('user-1', 'room-1');

      expect(memberRepository.save).toHaveBeenCalled();
    });

    it('should throw error if user not in room', async () => {
      memberRepository.findMemberWithRole.mockResolvedValue(null);

      await expect(service.leaveRoom('user-1', 'room-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('kickMember', () => {
    it('should kick a member from room', async () => {
      const admin = { ...mockMember, role: MemberRole.ADMIN };
      memberRepository.findMemberWithRole
        .mockResolvedValueOnce(admin as any)
        .mockResolvedValueOnce(mockMember as any);
      memberRepository.save.mockResolvedValue(mockMember as any);
      redisService.delete.mockResolvedValue(true);

      await service.kickMember('room-1', 'user-2', 'user-1', 'Spamming');

      expect(memberRepository.save).toHaveBeenCalled();
    });

    it('should not allow member to kick', async () => {
      const memberInitiator = { ...mockMember, role: MemberRole.MEMBER };
      memberRepository.findMemberWithRole.mockResolvedValueOnce(memberInitiator as any);

      await expect(
        service.kickMember('room-1', 'user-2', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not allow kicking self', async () => {
      const admin = { ...mockMember, role: MemberRole.ADMIN };
      memberRepository.findMemberWithRole.mockResolvedValueOnce(admin as any);

      await expect(
        service.kickMember('room-1', 'user-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const admin = { ...mockMember, role: MemberRole.ADMIN };
      const updated = { ...mockMember, role: MemberRole.MODERATOR };

      memberRepository.findMemberWithRole
        .mockResolvedValueOnce(admin as any)
        .mockResolvedValueOnce(mockMember as any);
      memberRepository.save.mockResolvedValue(updated as any);
      redisService.delete.mockResolvedValue(true);

      const result = await service.updateMemberRole(
        'room-1',
        'user-2',
        MemberRole.MODERATOR,
        'user-1',
      );

      expect(result.role).toBe(MemberRole.MODERATOR);
    });

    it('should throw error if initiator not admin', async () => {
      memberRepository.findMemberWithRole.mockResolvedValueOnce(mockMember as any);

      await expect(
        service.updateMemberRole('room-1', 'user-2', MemberRole.MODERATOR, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('isMember', () => {
    it('should return true if user is member', async () => {
      memberRepository.isMember.mockResolvedValue(true);

      const result = await service.isMember('room-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false if user is not member', async () => {
      memberRepository.isMember.mockResolvedValue(false);

      const result = await service.isMember('room-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('validateMaxMembers', () => {
    it('should indicate if room can add members', async () => {
      memberRepository.countMembers.mockResolvedValue(50);

      const result = await service.validateMaxMembers('room-1');

      expect(result.canAdd).toBe(true);
      expect(result.memberCount).toBe(50);
    });

    it('should indicate if room is full', async () => {
      memberRepository.countMembers.mockResolvedValue(100);

      const result = await service.validateMaxMembers('room-1');

      expect(result.canAdd).toBe(false);
    });
  });
});
