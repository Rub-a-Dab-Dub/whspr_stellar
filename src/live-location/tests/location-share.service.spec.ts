import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConversationParticipant } from '../../conversations/entities/conversation-participant.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { User, UserTier } from '../../users/entities/user.entity';
import { LocationShare } from '../entities/location-share.entity';
import { LocationShareService } from '../location-share.service';

const makeShare = (overrides: Partial<LocationShare> = {}): LocationShare =>
  ({
    id: 'share-1',
    userId: 'user-1',
    conversationId: 'conv-1',
    latitude: 6.5244,
    longitude: 3.3792,
    accuracy: null,
    duration: 30,
    expiresAt: new Date(Date.now() + 30 * 60_000),
    isActive: true,
    lastUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as LocationShare);

const makeRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exist: jest.fn(),
});

describe('LocationShareService', () => {
  let service: LocationShareService;
  let shareRepo: ReturnType<typeof makeRepo>;
  let convRepo: ReturnType<typeof makeRepo>;
  let participantsRepo: ReturnType<typeof makeRepo>;
  let usersRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    shareRepo = makeRepo();
    convRepo = makeRepo();
    participantsRepo = makeRepo();
    usersRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationShareService,
        { provide: getRepositoryToken(LocationShare), useValue: shareRepo },
        { provide: getRepositoryToken(Conversation), useValue: convRepo },
        { provide: getRepositoryToken(ConversationParticipant), useValue: participantsRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    service = module.get(LocationShareService);
  });

  describe('startSharing', () => {
    it('creates a new active share', async () => {
      convRepo.exist.mockResolvedValue(true);
      participantsRepo.exist.mockResolvedValue(true);
      usersRepo.findOneOrFail.mockResolvedValue({ tier: UserTier.SILVER });
      shareRepo.update.mockResolvedValue(undefined);
      const share = makeShare();
      shareRepo.create.mockReturnValue(share);
      shareRepo.save.mockResolvedValue(share);

      const result = await service.startSharing('user-1', 'conv-1', {
        latitude: 6.5244,
        longitude: 3.3792,
        duration: 30,
      });

      expect(result.isActive).toBe(true);
      expect(shareRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', conversationId: 'conv-1', isActive: true },
        { isActive: false },
      );
    });

    it('caps duration to tier max (SILVER = 60 min)', async () => {
      convRepo.exist.mockResolvedValue(true);
      participantsRepo.exist.mockResolvedValue(true);
      usersRepo.findOneOrFail.mockResolvedValue({ tier: UserTier.SILVER });
      shareRepo.update.mockResolvedValue(undefined);
      const share = makeShare({ duration: 60 });
      shareRepo.create.mockReturnValue(share);
      shareRepo.save.mockResolvedValue(share);

      await service.startSharing('user-1', 'conv-1', {
        latitude: 6.5244,
        longitude: 3.3792,
        duration: 999,
      });

      const createCall = shareRepo.create.mock.calls[0][0];
      expect(createCall.duration).toBe(60);
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      convRepo.exist.mockResolvedValue(false);
      await expect(
        service.startSharing('user-1', 'conv-1', { latitude: 1, longitude: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not a participant', async () => {
      convRepo.exist.mockResolvedValue(true);
      participantsRepo.exist.mockResolvedValue(false);
      await expect(
        service.startSharing('user-1', 'conv-1', { latitude: 1, longitude: 1 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateLocation', () => {
    it('updates coordinates and lastUpdatedAt', async () => {
      const share = makeShare();
      shareRepo.findOne.mockResolvedValue(share);
      shareRepo.save.mockResolvedValue({ ...share, latitude: 7.0, longitude: 4.0 });

      const result = await service.updateLocation('user-1', 'share-1', {
        latitude: 7.0,
        longitude: 4.0,
      });

      expect(shareRepo.save).toHaveBeenCalled();
      expect(result.latitude).toBe(7.0);
    });

    it('throws ForbiddenException when userId does not match', async () => {
      shareRepo.findOne.mockResolvedValue(makeShare({ userId: 'other-user' }));
      await expect(
        service.updateLocation('user-1', 'share-1', { latitude: 1, longitude: 1 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throttles updates within 5 seconds', async () => {
      const share = makeShare();
      shareRepo.findOne.mockResolvedValue(share);
      shareRepo.save.mockResolvedValue(share);

      // First call succeeds
      await service.updateLocation('user-1', 'share-1', { latitude: 1, longitude: 1 });

      // Second call within 5s should throw
      shareRepo.findOne.mockResolvedValue(makeShare());
      await expect(
        service.updateLocation('user-1', 'share-1', { latitude: 2, longitude: 2 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for expired share', async () => {
      shareRepo.findOne.mockResolvedValue(
        makeShare({ expiresAt: new Date(Date.now() - 1000) }),
      );
      shareRepo.delete.mockResolvedValue(undefined);
      await expect(
        service.updateLocation('user-1', 'share-1', { latitude: 1, longitude: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('stopSharing', () => {
    it('deletes the share record (no history retained)', async () => {
      shareRepo.findOne.mockResolvedValue(makeShare());
      shareRepo.delete.mockResolvedValue(undefined);

      await service.stopSharing('user-1', 'share-1');

      expect(shareRepo.delete).toHaveBeenCalledWith({ id: 'share-1' });
    });

    it('throws ForbiddenException when userId does not match', async () => {
      shareRepo.findOne.mockResolvedValue(makeShare({ userId: 'other-user' }));
      await expect(service.stopSharing('user-1', 'share-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getActiveShares', () => {
    it('returns active shares for conversation participants', async () => {
      convRepo.exist.mockResolvedValue(true);
      participantsRepo.exist.mockResolvedValue(true);
      shareRepo.find.mockResolvedValue([makeShare(), makeShare({ id: 'share-2', userId: 'user-2' })]);

      const result = await service.getActiveShares('user-1', 'conv-1');

      expect(result).toHaveLength(2);
      expect(result[0].isActive).toBe(true);
    });

    it('throws ForbiddenException for non-participants', async () => {
      convRepo.exist.mockResolvedValue(true);
      participantsRepo.exist.mockResolvedValue(false);
      await expect(service.getActiveShares('user-1', 'conv-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('expireStale', () => {
    it('deletes expired shares and returns count', async () => {
      const expired = [makeShare({ id: 'share-1' }), makeShare({ id: 'share-2' })];
      shareRepo.find.mockResolvedValue(expired);
      shareRepo.delete.mockResolvedValue(undefined);

      const count = await service.expireStale();

      expect(count).toBe(2);
      expect(shareRepo.delete).toHaveBeenCalledWith(['share-1', 'share-2']);
    });

    it('returns 0 when no stale shares exist', async () => {
      shareRepo.find.mockResolvedValue([]);
      const count = await service.expireStale();
      expect(count).toBe(0);
      expect(shareRepo.delete).not.toHaveBeenCalled();
    });
  });
});
