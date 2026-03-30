import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysRepository } from './api-keys.repository';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), UsersModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysRepository, ApiKeysService, ApiKeyAuthGuard],
  exports: [ApiKeysService, ApiKeyAuthGuard],
})
export class ApiKeysModule {}
