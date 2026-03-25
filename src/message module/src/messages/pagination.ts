export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string | null;
}

export interface PaginationQuery {
  limit: number;
  cursor?: string;
}

export function encodeCursor(sentAt: Date, id: string): string {
  return Buffer.from(`${sentAt.toISOString()}::${id}`).toString('base64');
}

export function decodeCursor(cursor: string): { sentAt: Date; id: string } | null {
  try {
    const [sentAtStr, id] = Buffer.from(cursor, 'base64').toString('utf8').split('::');
    if (!sentAtStr || !id) return null;
    return { sentAt: new Date(sentAtStr), id };
  } catch (err) {
    return null;
  }
}
