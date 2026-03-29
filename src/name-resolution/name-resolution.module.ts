import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NameResolutionController } from './name-resolution.controller';
import { NameResolutionService } from './name-resolution.service';
import { UsersModule } from '../users/users.module';
import { SorobanModule } from '../soroban/soroban.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 5,
    }),
    UsersModule,
    SorobanModule,
  ],
  controllers: [NameResolutionController],
  providers: [NameResolutionService],
  exports: [NameResolutionService],
})
export class NameResolutionModule {}
