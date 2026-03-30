import { ExecutionContext } from '@nestjs/common';
import { BlockGuard } from './block.guard';
import { BlockEnforcementService } from './block-enforcement.service';
import { ConversationsService } from '../conversations/services/conversations.service';

describe('BlockGuard', () => {
  let guard: BlockGuard;
  let blockService: jest.Mocked<BlockEnforcementService>;
  let conversationsService: jest.Mocked<ConversationsService>;

  beforeEach(() => {
    blockService = {
      canViewProfile: jest.fn().mockResolvedValue(undefined),
      canSendMessage: jest.fn().mockResolvedValue(undefined),
      canTransferFunds: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BlockEnforcementService>;

    conversationsService = {
      getConversation: jest.fn().mockResolvedValue({ participants: [{ userId: 'a' }, { userId: 'b' }] }),
    } as unknown as jest.Mocked<ConversationsService>;

    guard = new BlockGuard(blockService, conversationsService);
  });

  it('calls canViewProfile for user profile access', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/users/u2', params: { id: 'u2' }, user: { id: 'u1' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(blockService.canViewProfile).toHaveBeenCalledWith('u1', 'u2');
  });

  it('calls canSendMessage for conversation send', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          path: '/conversations/c1/messages',
          params: { id: 'c1' },
          user: { id: 'u1' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(conversationsService.getConversation).toHaveBeenCalledWith('c1', 'u1');
    expect(blockService.canSendMessage).toHaveBeenCalledWith('u1', ['b']);
  });
});
