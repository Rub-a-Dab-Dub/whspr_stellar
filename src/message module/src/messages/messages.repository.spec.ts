import { MessagesRepository } from './messages.repository';
import { ContentType } from './message.entity';

describe('MessagesRepository', () => {
  it('paginates and hides nextCursor when no more data', async () => {
    const repo = new MessagesRepository();
    const sentAt = new Date('2024-01-01T00:00:00Z');
    await repo.create({
      conversationId: 'c1',
      senderId: 'u1',
      content: 'hello',
      contentType: ContentType.TEXT,
      replyToId: null,
      sentAt,
    });

    const result = await repo.findByConversation('c1', { limit: 5 });
    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('honors cursor and save branches', async () => {
    const repo = new MessagesRepository();
    const first = await repo.create({
      conversationId: 'c1',
      senderId: 'u1',
      content: 'hello',
      contentType: ContentType.TEXT,
      replyToId: null,
      sentAt: new Date('2024-01-01T00:00:00Z'),
    });
    await repo.create({
      conversationId: 'c1',
      senderId: 'u1',
      content: 'second',
      contentType: ContentType.TEXT,
      replyToId: null,
      sentAt: new Date('2024-01-02T00:00:00Z'),
    });

    const firstPage = await repo.findByConversation('c1', { limit: 1 });
    expect(firstPage.nextCursor).toBeTruthy();

    // use cursor to fetch next item
    const secondPage = await repo.findByConversation('c1', { limit: 1, cursor: firstPage.nextCursor ?? undefined });
    expect(secondPage.data[0].content).toBe('second');

    // save branch when message absent (index -1)
    const newMessage = { ...first, id: 'custom', sentAt: new Date('2024-01-03T00:00:00Z') };
    await repo.save(newMessage);
    const all = await repo.findByConversation('c1', { limit: 10 });
    expect(all.data.some((m) => m.id === 'custom')).toBe(true);

    // cursor not found branch
    const bogusCursor = Buffer.from('2024-02-01T00:00:00.000Z::missing').toString('base64');
    const afterBogus = await repo.findByConversation('c1', { limit: 1, cursor: bogusCursor });
    expect(afterBogus.data[0].id).toBe(first.id);
  });
});
