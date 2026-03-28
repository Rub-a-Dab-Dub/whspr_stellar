import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Contact } from './entities/contact.entity';
import { ContactImportSession } from './entities/contact-import-session.entity';
import { UserContactHashIndex } from './entities/user-contact-hash-index.entity';
import { ContactsRepository } from './contacts.repository';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { ContactImportService } from './contact-import.service';
import { ContactImportController } from './contact-import.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, ContactImportSession, UserContactHashIndex]),
    ScheduleModule.forRoot(),
    BlockchainModule,
    AuthModule,
  ],
  providers: [ContactsRepository, ContactsService, ContactImportService],
  controllers: [ContactsController, ContactImportController],
  exports: [ContactsService, ContactImportService],
})
export class ContactsModule {}
