import { Test } from '@nestjs/testing';
import { BlockEnforcementController } from './block-enforcement.controller';
import { BlockEnforcementService } from './block-enforcement.service';

describe('BlockEnforcementController', () => {
  let controller: BlockEnforcementController;
  let service: jest.Mocked<BlockEnforcementService>;

  beforeEach(async () => {
    service = {
      getBlockedUsers: jest.fn().mockResolvedValue(['u2']),
      getBlockedByCount: jest.fn().mockResolvedValue(3),
      blockUser: jest.fn().mockResolvedValue(undefined),
      unblockUser: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BlockEnforcementService>;

    const moduleRef = await Test.createTestingModule({
      controllers: [BlockEnforcementController],
      providers: [{ provide: BlockEnforcementService, useValue: service }],
    }).compile();

    controller = moduleRef.get(BlockEnforcementController);
  });

  it('returns blocked users', async () => {
    const result = await controller.getBlocked({ user: { id: 'u1' } });
    expect(result).toEqual(['u2']);
    expect(service.getBlockedUsers).toHaveBeenCalledWith('u1');
  });

  it('returns blocked-by count', async () => {
    const result = await controller.getBlockedByCount({ user: { id: 'u1' } });
    expect(result).toEqual({ blockedByCount: 3 });
    expect(service.getBlockedByCount).toHaveBeenCalledWith('u1');
  });

  it('blocks and unblocks users', async () => {
    await expect(controller.blockUser({ user: { id: 'u1' } }, 'u2')).resolves.toEqual({ success: true });
    expect(service.blockUser).toHaveBeenCalledWith('u1', 'u2');

    await expect(controller.unblockUser({ user: { id: 'u1' } }, 'u2')).resolves.toEqual({ success: true });
    expect(service.unblockUser).toHaveBeenCalledWith('u1', 'u2');
  });
});
