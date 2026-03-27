import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Poll, PollVote } from './entities/poll.entity';
import { PollsController } from './controllers/polls.controller';
import { PollsService } from './services/polls.service';
import { PollsRepository } from './repositories/polls.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Poll, PollVote])],
  controllers: [PollsController],
  providers: [PollsService, PollsRepository],
  exports: [PollsService],
})
export class PollsModule {}
