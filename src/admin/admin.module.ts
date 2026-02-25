import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { UserModule } from '../user/user.module';
import { User } from '../user/entities/user.entity';
import { Payment } from '../payments/entities/payment.entity';
import { MessageMedia } from '../messages/entities/message-media.entity';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([User, Payment, MessageMedia]),
  ],
  controllers: [AdminController, AdminStatsController],
  providers: [AdminStatsService],
})
export class AdminModule {}
