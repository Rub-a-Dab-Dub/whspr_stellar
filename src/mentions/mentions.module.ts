import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mention } from './entities/mention.entity';
import { MentionsController } from './controllers/mentions.controller';
import { MentionsService } from './services/mentions.service';
import { MentionsRepository } from './repositories/mentions.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Mention])],
  controllers: [MentionsController],
  providers: [MentionsService, MentionsRepository],
  exports: [MentionsService],
})
export class MentionsModule {}
