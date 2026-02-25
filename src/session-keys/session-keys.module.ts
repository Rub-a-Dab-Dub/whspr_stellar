import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionKey } from './entities/session-key.entity';
import { SessionKeyService } from './session-keys.service';
import { SessionKeyController } from './session-keys.controller';
import { SessionKeyGuard } from './guards/session-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([SessionKey])],
  controllers: [SessionKeyController],
  providers: [SessionKeyService, SessionKeyGuard],
  exports: [SessionKeyService, SessionKeyGuard],
})
export class SessionKeysModule {}
