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
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { MessagingModule } from '../messaging/messaging.module';
import { User } from '../users/entities/user.entity';
import { PollVote } from './entities/poll-vote.entity';
import { Poll } from './entities/poll.entity';
import { PollsController } from './polls.controller';
import { PollsExpiryJob } from './polls-expiry.job';
import { PollsRepository } from './polls.repository';
import { PollsService } from './polls.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Poll, PollVote, Conversation, ConversationParticipant, User]),
    MessagingModule,
  ],
  controllers: [PollsController],
  providers: [PollsRepository, PollsService, PollsExpiryJob],
  exports: [PollsService],
})
export class PollsModule {}
