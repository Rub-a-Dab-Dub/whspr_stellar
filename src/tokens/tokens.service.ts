import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { TokensRepository } from './tokens.repository';
import { TokensPriceService } from './tokens-price.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { Token, TokenNetwork } from './entities/token.entity';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    private readonly tokensRepository: TokensRepository,
    private readonly priceService: TokensPriceService,
  ) {}

  async create(dto: CreateTokenDto): Promise<Token> {
    const existing = await this.tokensRepository.findByAddress(dto.address);
    if (existing) {
      throw new ConflictException(
        `Token with address ${dto.address} already exists`,
      );
    }

    const token = this.tokensRepository.create({
      ...dto,
      decimals: dto.decimals ?? 7,
      network: dto.network ?? TokenNetwork.STELLAR_MAINNET,
      isNative: dto.isNative ?? false,
      isWhitelisted: false,
    });

    return this.tokensRepository.save(token);
  }

  async findAll(): Promise<Token[]> {
    return this.tokensRepository.findAll();
  }

  async findById(id: string): Promise<Token> {
    const token = await this.tokensRepository.findById(id);
    if (!token) throw new NotFoundException(`Token ${id} not found`);
    return token;
  }

  async findByAddress(address: string): Promise<Token> {
    const token = await this.tokensRepository.findByAddress(address);
    if (!token) throw new NotFoundException(`Token with address ${address} not found`);
    return token;
  }

  async findWhitelisted(): Promise<Token[]> {
    return this.tokensRepository.findWhitelisted();
  }

  async findByNetwork(network: TokenNetwork): Promise<Token[]> {
    return this.tokensRepository.findByNetwork(network);
  }

  async whitelist(id: string): Promise<Token> {
    const token = await this.findById(id);
    token.isWhitelisted = true;
    return this.tokensRepository.save(token);
  }

  async unwhitelist(id: string): Promise<Token> {
    const token = await this.findById(id);
    token.isWhitelisted = false;
    return this.tokensRepository.save(token);
  }

  async refreshPrice(id: string): Promise<Token> {
    const token = await this.findById(id);

    if (!token.coingeckoId) {
      this.logger.warn(`Token ${id} has no coingeckoId — skipping price fetch`);
      return token;
    }

    const price = await this.priceService.fetchPrice(token.coingeckoId);
    token.currentPrice = price;
    token.priceUpdatedAt = new Date();
    return this.tokensRepository.save(token);
  }

  async refreshAllPrices(): Promise<void> {
    const tokens = await this.tokensRepository.findAll();
    const priceMap = await this.priceService.fetchPricesBatch(tokens);

    for (const token of tokens) {
      const price = priceMap.get(token.id);
      if (price !== undefined) {
        token.currentPrice = price;
        token.priceUpdatedAt = new te();
        await this.tokensRepository.save(token);
      }
    }

    this.logger.log(`Refreshed prices for ${priceMap.size} tokens`);
  }

  async remove(id: string): Promise<void> {
    const token = await this.findById(id);
    await this.tokensRepository.remove(token);
  }
}
