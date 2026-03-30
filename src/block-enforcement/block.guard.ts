import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { BlockEnforcementService } from './block-enforcement.service';
import { ConversationsService } from '../conversations/services/conversations.service';

@Injectable()
export class BlockGuard implements CanActivate {
  constructor(
    private readonly blockEnforcementService: BlockEnforcementService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { method, path, params, user, headers } = request;

    const actorId = user?.id || headers['x-user-id'];
    if (!actorId) {
      return true;
    }

    if (path === '/users/me' && method === 'GET') {
      return true;
    }

    if (path.startsWith('/users/') && method === 'GET' && params?.id) {
      await this.blockEnforcementService.canViewProfile(actorId, params.id);
      return true;
    }

    if (path.match(/^\/conversations\/[a-fA-F0-9-]+\/messages$/i) && method === 'POST') {
      const conversationId = params?.id;
      if (!conversationId) {
        return true;
      }

      const conversation = await this.conversationsService.getConversation(conversationId, actorId);
      const recipients = conversation.participants
        .map((p: any) => p.userId)
        .filter((id: string) => id !== actorId);

      await this.blockEnforcementService.canSendMessage(actorId, recipients);
      return true;
    }

    if (path.match(/^\/conversations\/[a-fA-F0-9-]+\/transfers$/i) && method === 'POST') {
      // transfer flow does its own checks inside service, but we can pre-check membership
      const conversationId = params?.id;
      if (!conversationId) {
        return true;
      }

      const conversation = await this.conversationsService.getConversation(conversationId, actorId);
      const recipients = conversation.participants
        .map((p: any) => p.userId)
        .filter((id: string) => id !== actorId);

      await this.blockEnforcementService.canTransferFunds(actorId, recipients);
      return true;
    }

    if (path.match(/^\/transfers\/[a-fA-F0-9-]+\/confirm$/i) && method === 'POST') {
      // Confirmation guard: underlying service will also apply checks
      return true;
    }

    return true;
  }
}
