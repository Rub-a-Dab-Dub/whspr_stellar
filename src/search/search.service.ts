import { Injectable, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SearchQueryDto, SearchType } from './dto/search-query.dto';
import {
  SearchResponseDto,
  SearchResultData,
  SearchResultItem,
} from './dto/search-response.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ─── Public entry point ───────────────────────────────────────────────────

  async search(dto: SearchQueryDto): Promise<SearchResponseDto> {
    const start = Date.now();
    const cacheKey = this.getCacheKey(dto);

    const cached = await this.cacheManager.get<SearchResponseDto>(cacheKey);
    if (cached) {
      return { ...cached, took: Date.now() - start };
    }

    const result = await this.executeSearch(dto);
    result.took = Date.now() - start;

    await this.cacheManager.set(cacheKey, result, 30_000);
    return result;
  }

  // ─── Individual search methods ────────────────────────────────────────────

  async searchUsers(
    dto: SearchQueryDto,
    limit = dto.limit ?? 20,
    offset = 0,
  ): Promise<SearchResultData> {
    const tsQuery = this.sanitizeQuery(dto.q);

    try {
      const [rows, countRows]: [any[], any[]] = await Promise.all([
        this.dataSource.query(
          `
          SELECT
            id,
            username,
            "displayName",
            "avatarUrl",
            "walletAddress",
            ts_rank("searchVector", websearch_to_tsquery('english', $1)) AS rank,
            ts_headline(
              'english',
              COALESCE(username, '') || ' ' || COALESCE("displayName", '') || ' ' || COALESCE(bio, ''),
              websearch_to_tsquery('english', $1),
              'MaxWords=15, MinWords=5, ShortWord=2'
            ) AS highlight
          FROM users
          WHERE "isActive" = true
            AND "searchVector" @@ websearch_to_tsquery('english', $1)
          ORDER BY rank DESC
          LIMIT $2 OFFSET $3
          `,
          [tsQuery, limit, offset],
        ),
        this.dataSource.query(
          `
          SELECT COUNT(*) AS total
          FROM users
          WHERE "isActive" = true
            AND "searchVector" @@ websearch_to_tsquery('english', $1)
          `,
          [tsQuery],
        ),
      ]);

      return {
        rows: rows.map((r) => ({
          id: r.id,
          type: SearchType.USER,
          data: {
            username: r.username,
            displayName: r.displayName,
            avatarUrl: r.avatarUrl,
            walletAddress: r.walletAddress,
          },
          highlight: r.highlight,
          rank: parseFloat(r.rank),
        })),
        total: parseInt(countRows[0]?.total ?? '0', 10),
      };
    } catch {
      return { rows: [], total: 0 };
    }
  }

  async searchGroups(
    dto: SearchQueryDto,
    limit = dto.limit ?? 20,
    offset = 0,
  ): Promise<SearchResultData> {
    const tsQuery = this.sanitizeQuery(dto.q);

    try {
      const [rows, countRows]: [any[], any[]] = await Promise.all([
        this.dataSource.query(
          `
          SELECT
            id,
            name,
            description,
            "isPublic",
            "createdAt",
            ts_rank("searchVector", websearch_to_tsquery('english', $1)) AS rank,
            ts_headline(
              'english',
              COALESCE(name, '') || ' ' || COALESCE(description, ''),
              websearch_to_tsquery('english', $1),
              'MaxWords=15, MinWords=5, ShortWord=2'
            ) AS highlight
          FROM groups
          WHERE "searchVector" @@ websearch_to_tsquery('english', $1)
          ORDER BY rank DESC
          LIMIT $2 OFFSET $3
          `,
          [tsQuery, limit, offset],
        ),
        this.dataSource.query(
          `
          SELECT COUNT(*) AS total
          FROM groups
          WHERE "searchVector" @@ websearch_to_tsquery('english', $1)
          `,
          [tsQuery],
        ),
      ]);

      return {
        rows: rows.map((r) => ({
          id: r.id,
          type: SearchType.GROUP,
          data: {
            name: r.name,
            description: r.description,
            isPublic: r.isPublic,
            createdAt: r.createdAt,
          },
          highlight: r.highlight,
          rank: parseFloat(r.rank),
        })),
        total: parseInt(countRows[0]?.total ?? '0', 10),
      };
    } catch {
      return { rows: [], total: 0 };
    }
  }

  async searchMessages(
    dto: SearchQueryDto,
    limit = dto.limit ?? 20,
    offset = 0,
  ): Promise<SearchResultData> {
    const { q, groupId, dateFrom, dateTo } = dto;
    const tsQuery = this.sanitizeQuery(q);

    const params: unknown[] = [tsQuery];
    const conditions: string[] = [`"searchVector" @@ websearch_to_tsquery('english', $1)`];

    if (groupId) {
      params.push(groupId);
      conditions.push(`"groupId" = $${params.length}`);
    }
    if (dateFrom) {
      params.push(new Date(dateFrom));
      conditions.push(`"createdAt" >= $${params.length}`);
    }
    if (dateTo) {
      params.push(new Date(dateTo));
      conditions.push(`"createdAt" <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');
    const countParams = [...params];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(limit, offset);

    try {
      const [rows, countRows]: [any[], any[]] = await Promise.all([
        this.dataSource.query(
          `
          SELECT
            id,
            content,
            "groupId",
            "senderId",
            "createdAt",
            ts_rank("searchVector", websearch_to_tsquery('english', $1)) AS rank,
            ts_headline(
              'english',
              content,
              websearch_to_tsquery('english', $1),
              'MaxWords=20, MinWords=5, ShortWord=2'
            ) AS highlight
          FROM messages
          WHERE ${whereClause}
          ORDER BY rank DESC, "createdAt" DESC
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
          `,
          params,
        ),
        this.dataSource.query(
          `SELECT COUNT(*) AS total FROM messages WHERE ${whereClause}`,
          countParams,
        ),
      ]);

      return {
        rows: rows.map((r) => ({
          id: r.id,
          type: SearchType.MESSAGE,
          data: {
            content: r.content,
            groupId: r.groupId,
            senderId: r.senderId,
            createdAt: r.createdAt,
          },
          highlight: r.highlight,
          rank: parseFloat(r.rank),
        })),
        total: parseInt(countRows[0]?.total ?? '0', 10),
      };
    } catch {
      return { rows: [], total: 0 };
    }
  }

  async searchTokens(
    dto: SearchQueryDto,
    limit = dto.limit ?? 20,
    offset = 0,
  ): Promise<SearchResultData> {
    const tsQuery = this.sanitizeQuery(dto.q);

    try {
      const [rows, countRows]: [any[], any[]] = await Promise.all([
        this.dataSource.query(
          `
          SELECT
            id,
            symbol,
            name,
            "contractAddress",
            network,
            "createdAt",
            ts_rank("searchVector", websearch_to_tsquery('english', $1)) AS rank,
            ts_headline(
              'english',
              COALESCE(symbol, '') || ' ' || COALESCE(name, ''),
              websearch_to_tsquery('english', $1),
              'MaxWords=15, MinWords=5, ShortWord=2'
            ) AS highlight
          FROM tokens
          WHERE "isActive" = true
            AND "searchVector" @@ websearch_to_tsquery('english', $1)
          ORDER BY rank DESC
          LIMIT $2 OFFSET $3
          `,
          [tsQuery, limit, offset],
        ),
        this.dataSource.query(
          `
          SELECT COUNT(*) AS total
          FROM tokens
          WHERE "isActive" = true
            AND "searchVector" @@ websearch_to_tsquery('english', $1)
          `,
          [tsQuery],
        ),
      ]);

      return {
        rows: rows.map((r) => ({
          id: r.id,
          type: SearchType.TOKEN,
          data: {
            symbol: r.symbol,
            name: r.name,
            contractAddress: r.contractAddress,
            network: r.network,
            createdAt: r.createdAt,
          },
          highlight: r.highlight,
          rank: parseFloat(r.rank),
        })),
        total: parseInt(countRows[0]?.total ?? '0', 10),
      };
    } catch {
      return { rows: [], total: 0 };
    }
  }

  async searchGlobal(dto: SearchQueryDto): Promise<SearchResponseDto> {
    const limit = dto.limit ?? 20;
    const offset = dto.cursor ? this.decodeCursor(dto.cursor) : 0;

    const [usersResult, groupsResult, messagesResult, tokensResult] = await Promise.all([
      this.searchUsers(dto, limit, 0),
      this.searchGroups(dto, limit, 0),
      this.searchMessages(dto, limit, 0),
      this.searchTokens(dto, limit, 0),
    ]);

    const allResults: SearchResultItem[] = [
      ...usersResult.rows,
      ...groupsResult.rows,
      ...messagesResult.rows,
      ...tokensResult.rows,
    ].sort((a, b) => b.rank - a.rank);

    const total =
      usersResult.total + groupsResult.total + messagesResult.total + tokensResult.total;
    const paged = allResults.slice(offset, offset + limit);
    const newOffset = offset + paged.length;

    return {
      results: paged,
      total,
      nextCursor:
        newOffset < allResults.length ? this.encodeCursor(newOffset) : undefined,
      took: 0,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async executeSearch(dto: SearchQueryDto): Promise<SearchResponseDto> {
    const { type = SearchType.ALL } = dto;
    const offset = dto.cursor ? this.decodeCursor(dto.cursor) : 0;
    const limit = dto.limit ?? 20;

    if (type === SearchType.ALL) {
      return this.searchGlobal(dto);
    }

    const methodMap: Record<string, () => Promise<SearchResultData>> = {
      [SearchType.USER]: () => this.searchUsers(dto, limit, offset),
      [SearchType.GROUP]: () => this.searchGroups(dto, limit, offset),
      [SearchType.MESSAGE]: () => this.searchMessages(dto, limit, offset),
      [SearchType.TOKEN]: () => this.searchTokens(dto, limit, offset),
    };

    const { rows, total } = await methodMap[type]();
    const newOffset = offset + rows.length;

    return {
      results: rows,
      total,
      nextCursor: newOffset < total ? this.encodeCursor(newOffset) : undefined,
      took: 0,
    };
  }

  private getCacheKey(dto: SearchQueryDto): string {
    const { q, type, limit, cursor, groupId, dateFrom, dateTo } = dto;
    return [
      'search',
      q,
      type ?? SearchType.ALL,
      limit ?? 20,
      cursor ?? '',
      groupId ?? '',
      dateFrom ?? '',
      dateTo ?? '',
    ].join(':');
  }

  private encodeCursor(offset: number): string {
    return Buffer.from(String(offset)).toString('base64url');
  }

  private decodeCursor(cursor: string): number {
    const val = parseInt(Buffer.from(cursor, 'base64url').toString(), 10);
    return isNaN(val) ? 0 : val;
  }

  private sanitizeQuery(q: string): string {
    return q.trim();
  }
}
