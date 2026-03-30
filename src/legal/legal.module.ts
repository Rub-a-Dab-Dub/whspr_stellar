import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { LegalDocument } from './entities/legal-document.entity';
import { UserConsent } from './entities/user-consent.entity';
import { LegalDocumentsRepository } from './legal-document.repository';
import { UserConsentsRepository } from './user-consent.repository';
import { LegalService } from './legal.service';
import { LegalEmailService } from './legal-email.service';
import { LegalController } from './legal.controller';
import { AdminLegalController } from './admin-legal.controller';
import { ConsentGuard } from './guards/consent.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([LegalDocument, UserConsent]), UsersModule],
  controllers: [LegalController, AdminLegalController],
  providers: [
    LegalDocumentsRepository,
    UserConsentsRepository,
    LegalService,
    LegalEmailService,
    {
      provide: APP_GUARD,
      useClass: ConsentGuard,
    },
  ],
  exports: [LegalService],
})
export class LegalModule {}
