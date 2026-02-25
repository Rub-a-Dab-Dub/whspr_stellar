import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './user.service';
import { UserController } from './user.controller';
import { XpModule } from '../xp/xp.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), XpModule],
  controllers: [UserController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
