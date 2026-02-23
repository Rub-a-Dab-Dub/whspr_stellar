import { Module } from '@nestjs/common';
import { MaintainanceService } from './maintainance.service';
import { MaintainanceController } from './maintainance.controller';

@Module({
  controllers: [MaintainanceController],
  providers: [MaintainanceService],
})
export class MaintainanceModule {}
