import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { TransferPreviewDto } from './dto/transfer-preview.dto';
import { TransferResponseDto } from './dto/transfer-response.dto';

@WebSocketGateway({
  namespace: '/transfers',
  cors: {
    origin: '*',
  },
})
export class TransfersGateway {
  @WebSocketServer()
  private server!: Server;

  emitTransferInitiated(conversationId: string, preview: TransferPreviewDto): void {
    this.server?.emit('transfer:initiated', {
      conversationId,
      preview,
    });
  }

  emitTransferCompleted(conversationId: string, transfer: TransferResponseDto): void {
    this.server?.emit('transfer:completed', {
      conversationId,
      transfer,
    });
  }
}
