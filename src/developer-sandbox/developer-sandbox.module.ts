import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DeveloperSandboxController } from './developer-sandbox.controller';
import { DeveloperSandboxService } from './developer-sandbox.service';
import { SandboxEnvironment } from './entities/sandbox-environment.entity';
import { SandboxTransaction } from './entities/sandbox-transaction.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([SandboxEnvironment, SandboxTransaction])],
  controllers: [DeveloperSandboxController],
  providers: [DeveloperSandboxService],
  exports: [DeveloperSandboxService],
})
export class DeveloperSandboxModule {}
