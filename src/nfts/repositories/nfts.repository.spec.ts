import { WalletNetwork } from '../../wallets/entities/wallet.entity';
import { NFT } from '../entities/nft.entity';
import { NFTsRepository } from './nfts.repository';

describe('NFTsRepository', () => {
  let repository: NFTsRepository;
  let queryBuilder: any;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'nft-1' }]),
    };

    repository = Object.create(NFTsRepository.prototype) as NFTsRepository;
    (repository as any).createQueryBuilder = jest.fn(() => queryBuilder);
    (repository as any).findOne = jest.fn();
  });

  it('findByOwnerId should apply ownership and filter clauses', async () => {
    const result = await repository.findByOwnerId('user-1', {
      collection: 'issuer.example',
      contractAddress: 'GISSUER',
      tokenId: 'ART1',
      network: WalletNetwork.STELLAR_MAINNET,
    });

    expect((repository as any).createQueryBuilder).toHaveBeenCalledWith('nft');
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'nft.ownerId = :ownerId',
      {
        ownerId: 'user-1',
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledTimes(4);
    expect(result).toEqual([{ id: 'nft-1' }]);
  });

  it('findOwnedById should scope the lookup to the owner', async () => {
    const nft = { id: 'nft-1' } as NFT;
    (repository as any).findOne.mockResolvedValue(nft);

    const result = await repository.findOwnedById('nft-1', 'user-1');

    expect((repository as any).findOne).toHaveBeenCalledWith({
      where: {
        id: 'nft-1',
        ownerId: 'user-1',
      },
    });
    expect(result).toBe(nft);
  });

  it('findByAsset should look up a single canonical Stellar asset', async () => {
    const nft = { id: 'nft-1' } as NFT;
    (repository as any).findOne.mockResolvedValue(nft);

    const result = await repository.findByAsset('GISSUER', 'ART1');

    expect((repository as any).findOne).toHaveBeenCalledWith({
      where: {
        contractAddress: 'GISSUER',
        tokenId: 'ART1',
        network: WalletNetwork.STELLAR_MAINNET,
      },
    });
    expect(result).toBe(nft);
  });
});
