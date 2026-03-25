import { MessagesGateway } from './messages.gateway';
import { Message, ContentType } from './message.entity';

describe('MessagesGateway', () => {
  it('emits new message payload', () => {
    const gateway = new MessagesGateway();
    const emitted: any[] = [];
    // mock socket server
    (gateway as any).server = { to: () => ({ emit: (_: string, payload: any) => emitted.push(payload) }) };
    const message: Message = {
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      content: 'data',
      contentType: ContentType.TEXT,
      replyToId: null,
      isDeleted: false,
      isEdited: false,
      sentAt: new Date(),
      deliveredAt: null,
      readAt: null,
      editedAt: null,
    };

    gateway.emitNewMessage(message);
    expect(emitted[0].id).toBe('m1');
  });
});
