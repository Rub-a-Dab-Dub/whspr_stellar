import { Test } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './messages.repository';
import { MessagesGateway } from './messages.gateway';
import { SorobanService } from './soroban.service';
import { ContentType } from './message.entity';
import { ConversationsService } from '../../Conversation Module/src/conversations/services/conversations.service';
import { BlockEnforcementService } from '../../block-enforcement/block-enforcement.service';

class GatewayMock {
  emitNewMessage = jest.fn();
}

class SorobanMock {
  submitMessageHash = jest.fn().mockResolvedValue(undefined);
}

describe('MessagesService', () => {
  let service: MessagesService;
  let repository: MessagesRepository;
  let gateway: GatewayMock;
  let soroban: SorobanMock;

  beforeEach(async () => {
    const conversationsServiceMock = {
      getConversation: jest.fn().mockResolvedValue({ participants: [{ userId: 'u1' }, { userId: 'u2' }] }),
    } as unknown as ConversationsService;

    const blockEnforcementServiceMock = {
      canSendMessage: jest.fn().mockResolvedValue(undefined),
    } as unknown as BlockEnforcementService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        MessagesRepository,
        { provide: MessagesGateway, useClass: GatewayMock },
        { provide: SorobanService, useClass: SorobanMock },
        { provide: ConversationsService, useValue: conversationsServiceMock },
        { provide: BlockEnforcementService, useValue: blockEnforcementServiceMock },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
    repository = moduleRef.get(MessagesRepository);
    gateway = moduleRef.get(MessagesGateway);
    soroban = moduleRef.get(SorobanService);
  });

  it('sends a message and emits websocket + soroban hash', async () => {
    const msg = await service.sendMessage('c1', 'u1', {
      content: 'hello',
      contentType: ContentType.TEXT,
    });

    expect(msg.content).toBe(Buffer.from('hello').toString('base64'));
    expect(gateway.emitNewMessage).toHaveBeenCalledWith(msg);
    expect(soroban.submitMessageHash).toHaveBeenCalledWith(msg.id, 'hello');
  });

  it('edits a message and flags edited', async () => {
    const msg = await service.sendMessage('c1', 'u1', { content: 'hello', contentType: ContentType.TEXT });
    const edited = await service.editMessage(msg.id, { content: 'updated' });

    expect(edited.isEdited).toBe(true);
    expect(edited.editedAt).toBeInstanceOf(Date);
    expect(edited.content).toBe(Buffer.from('updated').toString('base64'));
  });

  it('soft deletes a message', async () => {
    const msg = await service.sendMessage('c1', 'u1', { content: 'hello', contentType: ContentType.TEXT });
    const deleted = await service.deleteMessage(msg.id);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.content).toBeNull();
  });

  it('prevents editing a deleted message', async () => {
    const msg = await service.sendMessage('c1', 'u1', { content: 'hello', contentType: ContentType.TEXT });
    await service.deleteMessage(msg.id);
    await expect(service.editMessage(msg.id, { content: 'nope' })).rejects.toThrow('deleted');
  });

  it('throws on missing message', async () => {
    await expect(service.getMessageById('missing')).rejects.toThrow('Message not found');
  });

  it('throws on missing delivery/read targets', async () => {
    await expect(service.markDelivered('missing')).rejects.toThrow('Message not found');
    await expect(service.markRead('missing')).rejects.toThrow('Message not found');
  });

  it('throws on missing edit/delete targets', async () => {
    await expect(service.editMessage('missing', { content: 'x' })).rejects.toThrow('Message not found');
    await expect(service.deleteMessage('missing')).rejects.toThrow('Message not found');
  });

  it('paginates oldest first with cursor', async () => {
    for (let i = 0; i < 5; i += 1) {
      await service.sendMessage('c1', 'u1', { content: `m${i}`, contentType: ContentType.TEXT });
    }
    const page1 = await service.getMessages('c1', { limit: 2 });
    expect(page1.data).toHaveLength(2);
    const page2 = await service.getMessages('c1', { limit: 2, cursor: page1.nextCursor ?? undefined });
    expect(page2.data[0].sentAt.getTime()).toBeGreaterThanOrEqual(page1.data[0].sentAt.getTime());
  });

  it('marks delivered and read', async () => {
    const msg = await service.sendMessage('c1', 'u1', { content: 'hey', contentType: ContentType.TEXT });
    const delivered = await service.markDelivered(msg.id);
    expect(delivered.deliveredAt).toBeInstanceOf(Date);

    const read = await service.markRead(msg.id);
    expect(read.readAt).toBeInstanceOf(Date);

    // calling markDelivered twice should keep first timestamp
    const deliveredAgain = await service.markDelivered(msg.id);
    expect(deliveredAgain.deliveredAt?.getTime()).toBe(delivered.deliveredAt?.getTime());
  });
});
