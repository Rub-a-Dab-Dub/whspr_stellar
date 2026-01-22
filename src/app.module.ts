import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import evmConfig from './config/evm.config';
import redisConfig from './config/redis.config';
import { validationSchema } from './config/validation.schema';
import { RedisModule } from './redis/redis.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { HealthModule } from './health/health.module';
import { SessionModule } from './session/session.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, evmConfig, redisConfig],
      validationSchema,
    }),
    RedisModule,
    CacheModule,
    QueueModule,
    HealthModule,
    SessionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
