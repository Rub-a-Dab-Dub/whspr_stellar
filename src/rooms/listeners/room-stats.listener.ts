import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RoomStatsService } from '../services/room-stats.service';

export class MessageSentEvent {
  roomId: string;
  userId: string;
  tipAmount?: bigint;
}

@Injectable()
export class RoomStatsListener {
  constructor(private statsService: RoomStatsService) {}

  @OnEvent('message.sent')
  async handleMessageSent(event: MessageSentEvent) {
    await this.statsService.trackMessage(
      event.roomId,
      event.userId,
      event.tipAmount || BigInt(0),
    );
  }
}
