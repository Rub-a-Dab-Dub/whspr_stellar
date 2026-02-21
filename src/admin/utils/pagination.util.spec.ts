import 'reflect-metadata';
import { SelectQueryBuilder } from 'typeorm';
import { paginateQuery } from './pagination.util';
import { PaginationQueryDto, SortOrder } from '../dto/pagination-query.dto';

describe('paginateQuery utility', () => {
    let mockQueryBuilder: any;

    beforeEach(() => {
        mockQueryBuilder = {
            alias: 'test_entity',
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        };
    });

    it('should apply default pagination (page 1, limit 20)', async () => {
        const dto: PaginationQueryDto = { page: 1, limit: 20 };
        await paginateQuery(mockQueryBuilder, dto);

        expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
        expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('should calculate skip correctly for different pages', async () => {
        const dto: PaginationQueryDto = { page: 3, limit: 10 };
        await paginateQuery(mockQueryBuilder, dto);

        expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
        expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should apply sorting with alias when sortBy is provided without alias', async () => {
        const dto: PaginationQueryDto = { sortBy: 'name', sortOrder: SortOrder.ASC };
        await paginateQuery(mockQueryBuilder, dto);

        expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('test_entity.name', 'ASC');
    });

    it('should apply sorting without prepending alias when sortBy already has an alias', async () => {
        const dto: PaginationQueryDto = { sortBy: 'other_alias.name', sortOrder: SortOrder.DESC };
        await paginateQuery(mockQueryBuilder, dto);

        expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('other_alias.name', 'DESC');
    });

    it('should return data and total correctly', async () => {
        const mockData = [{ id: 1 }, { id: 2 }];
        const mockTotal = 2;
        mockQueryBuilder.getManyAndCount.mockResolvedValue([mockData, mockTotal]);

        const dto: PaginationQueryDto = {};
        const result = await paginateQuery(mockQueryBuilder, dto);

        expect(result).toEqual({ data: mockData, total: mockTotal });
    });
});
