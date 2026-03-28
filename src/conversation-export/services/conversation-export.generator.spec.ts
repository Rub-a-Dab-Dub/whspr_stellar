import { ConversationExportFormat } from '../entities/conversation-export-job.entity';
import {
  ConversationExportGenerator,
  ConversationExportMessage,
} from './conversation-export.generator';

describe('ConversationExportGenerator', () => {
  const generator = new ConversationExportGenerator();

  const messages: ConversationExportMessage[] = [
    {
      id: 'm1',
      senderId: 'u1',
      type: 'text',
      content: 'Hello world',
      createdAt: new Date('2026-03-28T12:00:00.000Z'),
      attachments: [
        {
          id: 'a1',
          fileName: 'photo.png',
          mimeType: 'image/png',
          fileSize: 1024,
          fileUrl: 'https://cdn.example.com/photo.png',
        },
      ],
    },
  ];

  it('generates TXT export in WhatsApp-style line format', () => {
    const output = generator.generate('conv-1', messages, ConversationExportFormat.TXT).toString('utf8');

    expect(output).toContain('[2026-03-28 12:00:00.000 UTC] u1: Hello world');
    expect(output).toContain('[Attachment] photo.png (image/png) https://cdn.example.com/photo.png');
  });

  it('generates JSON export with metadata and message array', () => {
    const output = generator.generate('conv-1', messages, ConversationExportFormat.JSON).toString('utf8');
    const parsed = JSON.parse(output);

    expect(parsed.conversationId).toBe('conv-1');
    expect(parsed.messageCount).toBe(1);
    expect(parsed.messages[0].attachments[0].fileUrl).toBe('https://cdn.example.com/photo.png');
  });

  it('generates HTML export with bubble layout and attachment links', () => {
    const output = generator.generate('conv-1', messages, ConversationExportFormat.HTML).toString('utf8');

    expect(output).toContain('<!doctype html>');
    expect(output).toContain('class="bubble"');
    expect(output).toContain('https://cdn.example.com/photo.png');
  });
});
