import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Group } from './entities/group.entity';
import { Message } from './entities/message.entity';
import { Token } from './entities/token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, Message, Token]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({
        // Default: in-memory store (30 s TTL).
        // To use Redis, install cache-manager-ioredis-yet and configure:
        //   store: require('cache-manager-ioredis-yet'),
        //   host: configService.get('REDIS_HOST'),
        //   port: configService.get('REDIS_PORT'),
        //   password: configService.get('REDIS_PASSWORD'),
        ttl: 30_000,
      }),
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
