import { Test } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ContentType, Message } from './message.entity';
import { PaginatedResult } from './pagination';

const sampleMessage = (): Message => ({
  id: 'm1',
  conversationId: 'c1',
  senderId: 'u1',
  content: 'enc',
  contentType: ContentType.TEXT,
  replyToId: null,
  isDeleted: false,
  isEdited: false,
  sentAt: new Date('2024-01-01T00:00:00.000Z'),
  deliveredAt: null,
  readAt: null,
  editedAt: null,
});

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: jest.Mocked<MessagesService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: {
            sendMessage: jest.fn(),
            getMessages: jest.fn(),
            editMessage: jest.fn(),
            deleteMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(MessagesController);
    service = moduleRef.get(MessagesService) as any;
  });

  it('delegates sendMessage', async () => {
    const msg = sampleMessage();
    service.sendMessage.mockResolvedValue(msg);

    const result = await controller.sendMessage('c1', 'u1', { content: 'hi', contentType: ContentType.TEXT });
    expect(result.id).toBe(msg.id);
    expect(service.sendMessage).toHaveBeenCalledWith('c1', 'u1', { content: 'hi', contentType: ContentType.TEXT });
  });

  it('paginates messages', async () => {
    const msg = sampleMessage();
    const paginated: PaginatedResult<Message> = { data: [msg], nextCursor: 'cursor-1' };
    service.getMessages.mockResolvedValue(paginated);

    const res = await controller.getMessages('c1', '1', 'cursor-0');
    expect(res.data[0].id).toBe(msg.id);
    expect(res.nextCursor).toBe('cursor-1');
    expect(service.getMessages).toHaveBeenCalledWith('c1', { limit: 1, cursor: 'cursor-0' });
  });

  it('defaults limit when NaN', async () => {
    const msg = sampleMessage();
    service.getMessages.mockResolvedValue({ data: [msg], nextCursor: null });

    await controller.getMessages('c1', 'not-a-number', undefined);
    expect(service.getMessages).toHaveBeenCalledWith('c1', { limit: 20, cursor: undefined });
  });

  it('edits and deletes messages', async () => {
    const msg = sampleMessage();
    service.editMessage.mockResolvedValue({ ...msg, isEdited: true, editedAt: new Date() });
    service.deleteMessage.mockResolvedValue({ ...msg, isDeleted: true, content: null });

    const edited = await controller.editMessage('m1', { content: 'new' });
    expect(edited.isEdited).toBe(true);

    const deleted = await controller.deleteMessage('m1');
    expect(deleted.isDeleted).toBe(true);
  });

  it('throws when sender id header missing', async () => {
    await expect(
      controller.sendMessage('c1', undefined as any, { content: 'hi', contentType: ContentType.TEXT }),
    ).rejects.toThrow();
  });
});
