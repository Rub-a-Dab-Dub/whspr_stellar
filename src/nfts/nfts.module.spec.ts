import { QueryUserNFTsDto } from './dto/query-user-nfts.dto';
import { NFT } from './entities/nft.entity';
import { NFTsModule } from './nfts.module';

describe('NFT module scaffolding', () => {
  it('should instantiate the module class', () => {
    expect(new NFTsModule()).toBeDefined();
  });

  it('should instantiate the entity class', () => {
    expect(new NFT()).toBeInstanceOf(NFT);
  });

  it('should instantiate the query dto', () => {
    expect(new QueryUserNFTsDto()).toBeInstanceOf(QueryUserNFTsDto);
  });
});
