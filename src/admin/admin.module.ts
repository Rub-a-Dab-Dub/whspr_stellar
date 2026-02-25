import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UsersModule } from 'src/user/user.module';

@Module({
  imports: [UsersModule],
  controllers: [AdminController],
})
export class AdminModule {}
