import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroupKeyManagementService } from './group-key-management.service';
import { GroupEncryptionKey } from './entities/group-encryption-key.entity';
import { MemberKeyBundle } from './entities/member-key-bundle.entity';

const makeRepo = () => ({
  create: jest.fn((e: Record<string, unknown>) => e),
  save: jest.fn((e: Record<string, unknown>) =>
    Promise.resolve({ id: 'key-uuid-1', ...e }),
  ),
  findOne: jest.fn(),
  find: jest.fn(),
  delete: jest.fn(),
});

describe('GroupKeyManagementService', () => {
  let service: GroupKeyManagementService;
  let keyRepo: ReturnType<typeof makeRepo>;
  let bundleRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    keyRepo = makeRepo();
    bundleRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupKeyManagementService,
        { provide: getRepositoryToken(GroupEncryptionKey), useValue: keyRepo },
        { provide: getRepositoryToken(MemberKeyBundle), useValue: bundleRepo },
      ],
    }).compile();

    service = module.get(GroupKeyManagementService);
  });

  it('should generate a new group key (first version)', async () => {
    keyRepo.findOne.mockResolvedValue(null);
    const result = await service.generateGroupKey('group-1');
    expect(keyRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'group-1',
        keyVersion: 1,
        isActive: true,
      }),
    );
    expect(keyRepo.save).toHaveBeenCalled();
    expect(result.keyVersion).toBe(1);
  });

  it('should deactivate previous key on rotation', async () => {
    keyRepo.findOne.mockResolvedValueOnce({
      id: 'old-key',
      groupId: 'group-1',
      keyVersion: 2,
      isActive: true,
    });
    const result = await service.generateGroupKey('group-1');
    expect(keyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'old-key', isActive: false }),
    );
    expect(result.keyVersion).toBe(3);
  });

  it('should distribute key to a member (no publicKey = base64 fallback)', async () => {
    keyRepo.findOne.mockResolvedValue({
      id: 'key-1',
      groupId: 'group-1',
      keyVersion: 1,
      isActive: true,
      keyMaterial: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    });
    const result = await service.distributeToMember('group-1', {
      memberId: 'member-1',
    });
    expect(bundleRepo.create).toHaveBeenCalled();
    expect(bundleRepo.save).toHaveBeenCalled();
    expect(result.encryptedGroupKey).toBeDefined();
  });

  it('should rotate group key and distribute', async () => {
    // generateGroupKey call
    keyRepo.findOne
      .mockResolvedValueOnce(null) // no existing active key
      .mockResolvedValue({
        id: 'new-key',
        groupId: 'group-1',
        keyVersion: 1,
        isActive: true,
        keyMaterial:
          'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      });

    const result = await service.rotateGroupKey('group-1', [
      'member-1',
      'member-2',
    ]);
    expect(result.newKeyVersion).toBe(1);
    expect(result.distributedTo).toBe(2);
  });

  it('should get member key bundle', async () => {
    keyRepo.findOne.mockResolvedValue({
      id: 'key-1',
      groupId: 'group-1',
      keyVersion: 3,
      isActive: true,
    });
    bundleRepo.findOne.mockResolvedValue({
      memberId: 'member-1',
      encryptedGroupKey: 'base64data',
      deviceId: 'default',
    });

    const result = await service.getMemberKeyBundle('group-1', 'member-1');
    expect(result.keyVersion).toBe(3);
    expect(result.encryptedGroupKey).toBe('base64data');
  });

  it('should throw when no key bundle found', async () => {
    keyRepo.findOne.mockResolvedValue({
      id: 'key-1',
      groupId: 'group-1',
      isActive: true,
    });
    bundleRepo.findOne.mockResolvedValue(null);
    await expect(
      service.getMemberKeyBundle('group-1', 'member-1'),
    ).rejects.toThrow('No key bundle found');
  });

  it('should revoke member key bundles on leave', async () => {
    keyRepo.findOne.mockResolvedValue({
      id: 'key-1',
      groupId: 'group-1',
      isActive: true,
    });
    bundleRepo.delete.mockResolvedValue({ affected: 1 });
    await service.revokeOnMemberLeave('group-1', 'member-1');
    expect(bundleRepo.delete).toHaveBeenCalledWith({
      groupKey: { id: 'key-1' },
      memberId: 'member-1',
    });
  });

  it('should get active key version', async () => {
    keyRepo.findOne.mockResolvedValue({
      groupId: 'group-1',
      keyVersion: 5,
      isActive: true,
    });
    const result = await service.getActiveKeyVersion('group-1');
    expect(result.keyVersion).toBe(5);
    expect(result.isActive).toBe(true);
  });

  it('should throw when no active key exists', async () => {
    keyRepo.findOne.mockResolvedValue(null);
    await expect(service.getActiveKey('group-1')).rejects.toThrow(
      'No active encryption key',
    );
  });
});
