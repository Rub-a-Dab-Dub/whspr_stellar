import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GroupKeyManagementService } from './group-key-management.service';

/* Event name constants are exported from room services */
export const ROOM_MEMBER_JOINED = 'room.member.joined';
export const ROOM_MEMBER_LEFT = 'room.member.left';
export const ROOM_MEMBER_KICKED = 'room.member.kicked';
export const ROOM_MEMBER_BANNED = 'room.member.banned';

export interface RoomMemberEvent {
  roomId: string;
  userId: string;
  memberIds?: string[];
}

@Injectable()
export class GroupKeyEventListener {
  private readonly logger = new Logger(GroupKeyEventListener.name);

  constructor(private readonly gkmService: GroupKeyManagementService) {}

  /**
   * When a member is kicked → revoke their key bundle + rotate key
   */
  @OnEvent(ROOM_MEMBER_KICKED)
  async onMemberKicked(event: RoomMemberEvent): Promise<void> {
    this.logger.log(
      `Member ${event.userId} kicked from ${event.roomId}, revoking + rotating`,
    );
    try {
      await this.gkmService.revokeOnMemberLeave(event.roomId, event.userId);
      if (event.memberIds?.length) {
        await this.gkmService.rotateGroupKey(event.roomId, event.memberIds);
      }
    } catch (err) {
      this.logger.error(`Key rotation after kick failed: ${err.message}`);
    }
  }

  /**
   * When a member is banned → revoke their key bundle + rotate key
   */
  @OnEvent(ROOM_MEMBER_BANNED)
  async onMemberBanned(event: RoomMemberEvent): Promise<void> {
    this.logger.log(
      `Member ${event.userId} banned from ${event.roomId}, revoking + rotating`,
    );
    try {
      await this.gkmService.revokeOnMemberLeave(event.roomId, event.userId);
      if (event.memberIds?.length) {
        await this.gkmService.rotateGroupKey(event.roomId, event.memberIds);
      }
    } catch (err) {
      this.logger.error(`Key rotation after ban failed: ${err.message}`);
    }
  }

  /**
   * When a member leaves voluntarily → revoke their key bundle only
   */
  @OnEvent(ROOM_MEMBER_LEFT)
  async onMemberLeft(event: RoomMemberEvent): Promise<void> {
    this.logger.log(
      `Member ${event.userId} left ${event.roomId}, revoking key bundle`,
    );
    try {
      await this.gkmService.revokeOnMemberLeave(event.roomId, event.userId);
    } catch (err) {
      this.logger.error(`Key revocation after leave failed: ${err.message}`);
    }
  }
}
