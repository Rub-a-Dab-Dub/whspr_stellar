import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class RoomEventsListener {
  private readonly logger = new Logger(RoomEventsListener.name);

  @OnEvent('room.expiring-soon')
  async handleExpiringRoom(payload: any) {
    this.logger.log(`Room ${payload.roomId} expiring in ${payload.minutesRemaining} minutes`);
    
    // Send notification to creator (WebSocket, Email, Push, etc.)
    // Example: this.notificationService.sendExpiryWarning(payload);
  }

  @OnEvent('room.cleanup')
  async handleRoomCleanup(payload: any) {
    this.logger.log(`Cleaning up room ${payload.roomId}, initiating gas refund process`);
    
    // Trigger Stellar smart contract cleanup and gas refund
    // Example: this.stellarService.cleanupRoom(payload);
  }

  @OnEvent('room.created')
  async handleRoomCreated(payload: any) {
    this.logger.log(`Room created: ${payload.roomId}`);
  }

  @OnEvent('room.extended')
  async handleRoomExtended(payload: any) {
    this.logger.log(`Room extended: ${payload.roomId}`);
  }
}