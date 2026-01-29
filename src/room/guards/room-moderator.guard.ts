import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomMember, MemberRole } from '../entities/room-member.entity';

@Injectable()
export class RoomModeratorGuard implements CanActivate {
  constructor(
    @InjectRepository(RoomMember)
    private memberRepository: Repository<RoomMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const roomId = request.params?.id;

    if (!userId || !roomId) {
      throw new ForbiddenException('Missing user or room ID');
    }

    const member = await this.memberRepository.findOne({
      where: { userId, roomId },
    });

    if (
      !member ||
      ![MemberRole.ADMIN, MemberRole.MODERATOR, MemberRole.OWNER].includes(member.role)
    ) {
      throw new ForbiddenException(
        'Only room admins and moderators can perform this action',
      );
    }

    request.roomMember = member;
    return true;
  }
}
