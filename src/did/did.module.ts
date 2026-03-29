import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DidRecord } from './entities/did-record.entity';
import { VerifiableCredential } from './entities/verifiable-credential.entity';
import { DidService } from './did.service';
import { DidController } from './did.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DidRecord, VerifiableCredential])],
  controllers: [DidController],
  providers: [DidService],
  exports: [DidService],
})
export class DidModule {}
