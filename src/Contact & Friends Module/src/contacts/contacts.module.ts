import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Contact } from './entities/contact.entity';
import { ContactsRepository } from './contacts.repository';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact]),
    ScheduleModule.forRoot(),
    BlockchainModule,
    AuthModule,
  ],
  providers: [ContactsRepository, ContactsService],
  controllers: [ContactsController],
  exports: [ContactsService],
})
export class ContactsModule {}
