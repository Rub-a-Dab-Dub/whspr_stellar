import { SelectQueryBuilder } from 'typeorm';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

/**
 * Applies pagination and sorting to a TypeORM SelectQueryBuilder.
 *
 * @param queryBuilder The TypeORM SelectQueryBuilder to apply pagination to
 * @param dto The PaginationQueryDto containing page, limit, sortBy, and sortOrder
 * @returns The modified SelectQueryBuilder
 */
export async function paginateQuery<T>(
  queryBuilder: SelectQueryBuilder<T>,
  dto: PaginationQueryDto,
): Promise<{ data: T[]; total: number }> {
  const page = dto.page || 1;
  const limit = dto.limit || 20;
  const skip = (page - 1) * limit;

  // Apply sorting if sortBy is provided
  if (dto.sortBy) {
    // If the sortBy doesn't include an alias, we assume it belongs to the main entity
    const orderColumn = dto.sortBy.includes('.')
      ? dto.sortBy
      : `${queryBuilder.alias}.${dto.sortBy}`;

    queryBuilder.orderBy(orderColumn, dto.sortOrder || 'DESC');
  }

  // Apply skip and take
  queryBuilder.skip(skip).take(limit);

  const [data, total] = await queryBuilder.getManyAndCount();

  return { data, total };
}
