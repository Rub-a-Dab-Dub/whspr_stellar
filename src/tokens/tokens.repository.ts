import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Token, TokenNetwork } from './entities/token.entity';

@Injectable()
export class TokensRepository {
  constructor(
    @InjectRepository(Token)
    private readonly repo: Repository<Token>,
  ) {}

  create(data: Partial<Token>): Token {
    return this.repo.create(data);
  }

  async save(token: Token): Promise<Token> {
    return this.repo.save(token);
  }

  async findAll(): Promise<Token[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Token | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByAddress(address: string): Promise<Token | null> {
    return this.repo.findOne({ where: { address } });
  }

  async findWhitelisted(): Promise<Token[]> {
    return this.repo.find({ where: { isWhitelisted: true }, order: { symbol: 'ASC' } });
  }

  async findByNetwork(network: TokenNetwork): Promise<Token[]> {
    return this.repo.find({ where: { network }, order: { symbol: 'ASC' } });
  }

  async remove(token: Token): Promise<void> {
    await this.repo.remove(token);
  }

  async countAll(): Promise<number> {
    return this.repo.count();
  }
}
