import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchQueryDto, SearchType } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';

const mockResponse: SearchResponseDto = {
  results: [
    {
      id: 'u1',
      type: SearchType.USER,
      data: { username: 'alice' },
      highlight: '<b>alice</b>',
      rank: 0.5,
    },
  ],
  total: 1,
  nextCursor: undefined,
  took: 12,
};

describe('SearchController', () => {
  let controller: SearchController;
  let service: jest.Mocked<SearchService>;

  beforeEach(async () => {
    const mockService = {
      search: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: mockService }],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    service = module.get(SearchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search()', () => {
    it('delegates to SearchService.search()', async () => {
      service.search.mockResolvedValue(mockResponse);

      const dto: SearchQueryDto = { q: 'alice', type: SearchType.USER, limit: 20 };
      const result = await controller.search(dto);

      expect(service.search).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });

    it('passes all query parameters to the service', async () => {
      service.search.mockResolvedValue({ ...mockResponse, results: [], total: 0 });

      const dto: SearchQueryDto = {
        q: 'hello',
        type: SearchType.MESSAGE,
        limit: 10,
        cursor: 'abc',
        groupId: 'g1',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      };

      await controller.search(dto);

      expect(service.search).toHaveBeenCalledWith(dto);
    });

    it('returns the SearchResponseDto from the service', async () => {
      service.search.mockResolvedValue(mockResponse);

      const result = await controller.search({ q: 'test' });

      expect(result.results).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.took).toBeDefined();
    });

    it('propagates service errors', async () => {
      service.search.mockRejectedValue(new Error('Service failed'));

      await expect(controller.search({ q: 'test' })).rejects.toThrow('Service failed');
    });

    it('returns empty results for a no-match query', async () => {
      service.search.mockResolvedValue({
        results: [],
        total: 0,
        nextCursor: undefined,
        took: 5,
      });

      const result = await controller.search({ q: 'zzznomatch' });

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('returns paginated results with nextCursor', async () => {
      service.search.mockResolvedValue({
        ...mockResponse,
        nextCursor: 'cursor123',
      });

      const result = await controller.search({ q: 'alice', limit: 1 });

      expect(result.nextCursor).toBe('cursor123');
    });

    it('handles global search (type=all) response', async () => {
      const globalResponse: SearchResponseDto = {
        results: [
          { id: 'u1', type: SearchType.USER,    data: {}, rank: 0.9 },
          { id: 't1', type: SearchType.TOKEN,   data: {}, rank: 0.8 },
          { id: 'g1', type: SearchType.GROUP,   data: {}, rank: 0.7 },
          { id: 'm1', type: SearchType.MESSAGE, data: {}, rank: 0.6 },
        ],
        total: 4,
        took: 50,
      };
      service.search.mockResolvedValue(globalResponse);

      const result = await controller.search({ q: 'test', type: SearchType.ALL });

      expect(result.results).toHaveLength(4);
      expect(result.results.map((r) => r.type)).toEqual([
        SearchType.USER,
        SearchType.TOKEN,
        SearchType.GROUP,
        SearchType.MESSAGE,
      ]);
    });
  });
});
