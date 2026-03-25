import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { NFT } from '../entities/nft.entity';

export interface NFTQueryFilters {
  collection?: string;
  contractAddress?: string;
  tokenId?: string;
  network?: string;
}

@Injectable()
export class NFTsRepository extends Repository<NFT> {
  constructor(private readonly dataSource: DataSource) {
    super(NFT, dataSource.createEntityManager());
  }

  async findByOwnerId(
    ownerId: string,
    filters: NFTQueryFilters = {},
  ): Promise<NFT[]> {
    const queryBuilder = this.createQueryBuilder('nft').where(
      'nft.ownerId = :ownerId',
      { ownerId },
    );

    if (filters.collection) {
      queryBuilder.andWhere('nft.collection = :collection', {
        collection: filters.collection,
      });
    }

    if (filters.contractAddress) {
      queryBuilder.andWhere('nft.contractAddress = :contractAddress', {
        contractAddress: filters.contractAddress,
      });
    }

    if (filters.tokenId) {
      queryBuilder.andWhere('nft.tokenId = :tokenId', {
        tokenId: filters.tokenId,
      });
    }

    if (filters.network) {
      queryBuilder.andWhere('nft.network = :network', {
        network: filters.network,
      });
    }

    return queryBuilder
      .orderBy('nft.updatedAt', 'DESC')
      .addOrderBy('nft.name', 'ASC')
      .getMany();
  }

  async findOwnedById(id: string, ownerId: string): Promise<NFT | null> {
    return this.findOne({
      where: {
        id,
        ownerId,
      },
    });
  }

  async findOneById(id: string): Promise<NFT | null> {
    return this.findOne({ where: { id } });
  }

  async findByAsset(
    contractAddress: string,
    tokenId: string,
    network: string = 'stellar',
  ): Promise<NFT | null> {
    return this.findOne({
      where: {
        contractAddress,
        tokenId,
        network,
      },
    });
  }

  async findForGating(
    ownerId: string,
    filters: NFTQueryFilters = {},
  ): Promise<NFT[]> {
    return this.findByOwnerId(ownerId, filters);
  }
}
