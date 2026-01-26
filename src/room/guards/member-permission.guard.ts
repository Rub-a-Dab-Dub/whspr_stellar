import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomMember } from '../entities/room-member.entity';
import { MemberPermission, ROLE_PERMISSIONS } from '../constants/room-member.constants';

@Injectable()
export class MemberPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(RoomMember)
    private memberRepository: Repository<RoomMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<MemberPermission>(
      'requiredPermission',
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const roomId = request.params?.id;

    if (!userId || !roomId) {
      throw new ForbiddenException('Missing user or room ID');
    }

    const member = await this.memberRepository.findOne({
      where: { userId, roomId },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const permissions = member.permissions || ROLE_PERMISSIONS[member.role];

    if (!permissions.includes(requiredPermission)) {
      throw new ForbiddenException(
        `You do not have permission: ${requiredPermission}`,
      );
    }

    request.roomMember = member;
    return true;
  }
}
