import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEncryptionKey } from './entities/group-encryption-key.entity';
import { MemberKeyBundle } from './entities/member-key-bundle.entity';
import { GroupKeyManagementService } from './group-key-management.service';
import { GroupKeyManagementController } from './group-key-management.controller';
import { GroupKeyEventListener } from './group-key-event.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupEncryptionKey, MemberKeyBundle]),
  ],
  providers: [GroupKeyManagementService, GroupKeyEventListener],
  controllers: [GroupKeyManagementController],
  exports: [GroupKeyManagementService],
})
export class GroupKeyManagementModule {}
