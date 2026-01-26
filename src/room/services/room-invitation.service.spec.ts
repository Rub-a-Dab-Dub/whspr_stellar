import { Test, TestingModule } from '@nestjs/testing';
import { RoomInvitationService } from './room-invitation.service';
import { RoomInvitationRepository } from '../repositories/room-invitation.repository';
import { QueueService } from '../../queue/queue.service';
import { RedisService } from '../../redis/redis.service';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InvitationStatus, RoomInvitation } from '../entities/room-invitation.entity';
import { MemberRole } from '../entities/room-member.entity';

describe('RoomInvitationService', () => {
  let service: RoomInvitationService;
  let invitationRepository: jest.Mocked<RoomInvitationRepository>;
  let queueService: jest.Mocked<QueueService>;
  let redisService: jest.Mocked<RedisService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockInvitation = {
    id: 'inv-1',
    roomId: 'room-1',
    invitedById: 'user-1',
    invitedUserId: 'user-2',
    invitedEmail: 'user@example.com',
    status: InvitationStatus.PENDING,
    inviteToken: 'token123',
    message: 'Join our room',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  const mockMember = {
    id: 'member-1',
    roomId: 'room-1',
    userId: 'user-1',
    role: MemberRole.ADMIN,
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomInvitationService,
        {
          provide: RoomInvitationRepository,
          useValue: {
            findPendingInvitations: jest.fn(),
            findByToken: jest.fn(),
            findByUserAndRoom: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            findExpired: jest.fn(),
            countSentByUser: jest.fn(),
            findRoomInvitations: jest.fn(),
          },
        },
        {
          provide: 'MemberRepository',
          useValue: {
            findMemberWithRole: jest.fn(),
          },
        },
        {
          provide: 'RoomRepository',
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: 'UserRepository',
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            addJob: jest.fn(),
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

    service = module.get<RoomInvitationService>(RoomInvitationService);
    invitationRepository = module.get(RoomInvitationRepository) as jest.Mocked<RoomInvitationRepository>;
    queueService = module.get(QueueService) as jest.Mocked<QueueService>;
    redisService = module.get(RedisService) as jest.Mocked<RedisService>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  describe('inviteMembers', () => {
    it('should invite multiple users to room', async () => {
      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          save: jest.fn().mockResolvedValue(mockInvitation),
        },
      };

      dataSource.createQueryRunner.mockReturnValue(queryRunner as any);
      invitationRepository.countSentByUser.mockResolvedValue(0);

      const result = await service.inviteMembers(
        'room-1',
        ['user-2', 'user-3'],
        'user-1',
        'Join us!',
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw error if inviter not in room', async () => {
      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      dataSource.createQueryRunner.mockReturnValue(queryRunner as any);
      invitationRepository.countSentByUser.mockResolvedValue(0);

      await expect(
        service.inviteMembers('room-1', ['user-2'], 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should enforce daily invitation limit', async () => {
      invitationRepository.countSentByUser.mockResolvedValue(99);

      await expect(
        service.inviteMembers('room-1', ['user-2', 'user-3'], 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPendingInvitations', () => {
    it('should get pending invitations for user', async () => {
      const invitations = [mockInvitation as any];
      invitationRepository.findPendingInvitations.mockResolvedValue([invitations, 1]);

      const result = await service.getPendingInvitations('user-2');

      expect(result.total).toBe(1);
      expect(result.invitations.length).toBe(1);
    });

    it('should return empty list if no pending invitations', async () => {
      invitationRepository.findPendingInvitations.mockResolvedValue([[], 0]);

      const result = await service.getPendingInvitations('user-2');

      expect(result.total).toBe(0);
      expect(result.invitations.length).toBe(0);
    });
  });

  describe('acceptInvitation', () => {
    it('should accept a pending invitation', async () => {
      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          save: jest.fn().mockResolvedValue({ userId: 'user-2', roomId: 'room-1' }),
        },
      };

      dataSource.createQueryRunner.mockReturnValue(queryRunner as any);
      invitationRepository.findOne.mockResolvedValue(mockInvitation as any);
      queueService.addJob.mockResolvedValue(undefined);

      const result = await service.acceptInvitation('inv-1', 'user-2');

      expect(result).toBeDefined();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queueService.addJob).toHaveBeenCalled();
    });

    it('should throw error if invitation already accepted', async () => {
      const acceptedInvitation = {
        ...mockInvitation,
        status: InvitationStatus.ACCEPTED,
      };
      invitationRepository.findOne.mockResolvedValue(acceptedInvitation as any);

      await expect(
        service.acceptInvitation('inv-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if invitation expired', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000),
      };
      invitationRepository.findOne.mockResolvedValue(expiredInvitation as any);

      await expect(
        service.acceptInvitation('inv-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if not the invited user', async () => {
      invitationRepository.findOne.mockResolvedValue(mockInvitation as any);

      await expect(
        service.acceptInvitation('inv-1', 'user-3'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectInvitation', () => {
    it('should reject a pending invitation', async () => {
      invitationRepository.findOne.mockResolvedValue(mockInvitation as any);
      invitationRepository.save.mockResolvedValue(mockInvitation as any);
      queueService.addJob.mockResolvedValue(undefined);

      await service.rejectInvitation('inv-1', 'user-2', 'Not interested');

      expect(invitationRepository.save).toHaveBeenCalled();
      expect(queueService.addJob).toHaveBeenCalled();
    });

    it('should throw error if not invited user', async () => {
      invitationRepository.findOne.mockResolvedValue(mockInvitation as any);

      await expect(
        service.rejectInvitation('inv-1', 'user-3'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('expireOldInvitations', () => {
    it('should expire old invitations', async () => {
      const expired = [mockInvitation as any];
      invitationRepository.findExpired.mockResolvedValue(expired);
      invitationRepository.save.mockResolvedValue(mockInvitation as any);

      const result = await service.expireOldInvitations();

      expect(result).toBe(1);
      expect(invitationRepository.save).toHaveBeenCalled();
    });

    it('should return 0 if no invitations to expire', async () => {
      invitationRepository.findExpired.mockResolvedValue([]);

      const result = await service.expireOldInvitations();

      expect(result).toBe(0);
    });
  });

  describe('getInvitationByToken', () => {
    it('should get invitation by valid token', async () => {
      invitationRepository.findByToken.mockResolvedValue(mockInvitation as any);

      const result = await service.getInvitationByToken('token123');

      expect(result).toBeDefined();
      expect(result.inviteToken).toBe('token123');
    });

    it('should return null for invalid token', async () => {
      invitationRepository.findByToken.mockResolvedValue(null);

      const result = await service.getInvitationByToken('invalid');

      expect(result).toBeNull();
    });
  });

  describe('resendInvitation', () => {
    it('should resend a pending invitation', async () => {
      invitationRepository.findOne.mockResolvedValue(mockInvitation as any);
      invitationRepository.save.mockResolvedValue(mockInvitation as any);
      queueService.addJob.mockResolvedValue(undefined);

      const result = await service.resendInvitation('inv-1', 'user-1');

      expect(result).toBeDefined();
      expect(invitationRepository.save).toHaveBeenCalled();
    });

    it('should throw error if not invitation sender', async () => {
      invitationRepository.findOne.mockResolvedValue(mockInvitation as any);

      await expect(
        service.resendInvitation('inv-1', 'user-3'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
