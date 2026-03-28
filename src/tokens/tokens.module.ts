import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Token } from './entities/token.entity';
import { TokensRepository } from './tokens.repository';
import { TokensService } from './tokens.service';
import { TokensPriceService } from './tokens-price.service';
import { TokensController } from './tokens.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Token]),
    HttpModule,
  ],
  controllers: [TokensController],
  providers: [TokensService, TokensRepository, TokensPriceService],
  exports: [TokensService, TokensRepository],
})
export class TokensModule {}
