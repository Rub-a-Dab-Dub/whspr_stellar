import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MessageService } from '../message.service';

@Injectable()
export class MessageOwnershipGuard implements CanActivate {
  constructor(private readonly messageService: MessageService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const messageId = request.params.id;
    const userId = request.user?.id;

    if (!messageId || !userId) {
      throw new ForbiddenException('Missing required parameters');
    }

    const message = await this.messageService.findById(messageId);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.authorId !== userId) {
      throw new ForbiddenException('You can only modify your own messages');
    }

    request.message = message;
    return true;
  }
}
