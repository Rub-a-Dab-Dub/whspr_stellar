import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [QueueModule, AdminModule],
})
export class AppModule {}
