import { Injectable } from '@nestjs/common';
import { ConversationExportFormat } from '../entities/conversation-export-job.entity';

export interface ConversationExportMessage {
  id: string;
  senderId: string | null;
  type: string;
  content: string;
  createdAt: Date;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    fileUrl: string;
  }>;
}

@Injectable()
export class ConversationExportGenerator {
  generate(
    conversationId: string,
    messages: ConversationExportMessage[],
    format: ConversationExportFormat,
  ): Buffer {
    if (format === ConversationExportFormat.TXT) {
      return Buffer.from(this.renderTxt(messages), 'utf8');
    }
    if (format === ConversationExportFormat.HTML) {
      return Buffer.from(this.renderHtml(conversationId, messages), 'utf8');
    }
    return Buffer.from(this.renderJson(conversationId, messages), 'utf8');
  }

  private renderTxt(messages: ConversationExportMessage[]): string {
    const lines: string[] = [];
    for (const message of messages) {
      const ts = this.formatTimestamp(message.createdAt);
      const sender = message.senderId ?? 'system';
      lines.push(`[${ts}] ${sender}: ${message.content}`);
      if (message.attachments.length > 0) {
        for (const attachment of message.attachments) {
          lines.push(`  [Attachment] ${attachment.fileName} (${attachment.mimeType}) ${attachment.fileUrl}`);
        }
      }
    }
    return lines.join('\n');
  }

  private renderJson(conversationId: string, messages: ConversationExportMessage[]): string {
    return JSON.stringify(
      {
        conversationId,
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          type: message.type,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          attachments: message.attachments.map((attachment) => ({
            id: attachment.id,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            fileSize: attachment.fileSize,
            fileUrl: attachment.fileUrl,
          })),
        })),
      },
      null,
      2,
    );
  }

  private renderHtml(conversationId: string, messages: ConversationExportMessage[]): string {
    const rows = messages
      .map((message) => {
        const sender = this.escapeHtml(message.senderId ?? 'system');
        const content = this.escapeHtml(message.content);
        const timestamp = this.formatTimestamp(message.createdAt);
        const attachmentHtml =
          message.attachments.length === 0
            ? ''
            : `<div class="attachments">${message.attachments
                .map(
                  (attachment) =>
                    `<a href="${this.escapeHtml(attachment.fileUrl)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(attachment.fileName)}</a>`,
                )
                .join('<br/>')}</div>`;
        return `<div class="bubble"><div class="meta">${sender} • ${timestamp}</div><div class="content">${content}</div>${attachmentHtml}</div>`;
      })
      .join('');

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Conversation Export</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fb; margin: 0; }
      .wrap { max-width: 880px; margin: 0 auto; padding: 24px; }
      h1 { font-size: 20px; margin: 0 0 20px; color: #1b2430; }
      .bubble { background: #fff; border: 1px solid #dfe5ef; border-radius: 16px; padding: 12px 14px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
      .meta { font-size: 12px; color: #607089; margin-bottom: 6px; }
      .content { font-size: 14px; color: #18212f; white-space: pre-wrap; }
      .attachments { margin-top: 8px; font-size: 13px; }
      .attachments a { color: #1a73e8; text-decoration: none; }
      .attachments a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Conversation ${this.escapeHtml(conversationId)}</h1>
      ${rows}
    </div>
  </body>
</html>`;
  }

  private formatTimestamp(value: Date): string {
    return value.toISOString().replace('T', ' ').replace('Z', ' UTC');
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
