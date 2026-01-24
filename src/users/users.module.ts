import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { PinataService } from './services/pinata.service';
import { XpHistory } from './entities/xp-history.entity';
import { PinataService } from './services/pinata.service';
import { XpService } from './services/xp.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, XpHistory])],
  controllers: [UsersController],
  providers: [UsersService, PinataService, XpService],
  exports: [UsersService, XpService],
})
export class UsersModule {}
