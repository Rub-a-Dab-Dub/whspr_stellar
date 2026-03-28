import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { WaitlistRepository } from './waitlist.repository';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { WaitlistGateway } from './waitlist.gateway';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaitlistEntry]),
    MailModule,
  ],
  providers: [WaitlistRepository, WaitlistService, WaitlistGateway],
  controllers: [WaitlistController],
  exports: [WaitlistService],
})
export class WaitlistModule {}