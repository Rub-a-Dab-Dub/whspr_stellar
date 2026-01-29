import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RoomMember, MemberRole, MemberStatus } from '../entities/room-member.entity';

@Injectable()
export class RoomMemberRepository extends Repository<RoomMember> {
  constructor(private dataSource: DataSource) {
    super(RoomMember, dataSource.createEntityManager());
  }

  async findRoomMembers(
    roomId: string,
    skip: number = 0,
    take: number = 20,
    role?: MemberRole,
    status?: MemberStatus,
  ): Promise<[RoomMember[], number]> {
    const query = this.createQueryBuilder('rm')
      .where('rm.roomId = :roomId', { roomId })
      .andWhere('rm.status = :status', { status: status || MemberStatus.ACTIVE })
      .leftJoinAndSelect('rm.user', 'user')
      .skip(skip)
      .take(take);

    if (role) {
      query.andWhere('rm.role = :role', { role });
    }

    return await query.getManyAndCount();
  }

  async findMemberWithRole(roomId: string, userId: string): Promise<RoomMember | null> {
    return await this.createQueryBuilder('rm')
      .where('rm.roomId = :roomId', { roomId })
      .andWhere('rm.userId = :userId', { userId })
      .leftJoinAndSelect('rm.user', 'user')
      .leftJoinAndSelect('rm.room', 'room')
      .getOne();
  }

  async findAdmins(roomId: string): Promise<RoomMember[]> {
    return await this.createQueryBuilder('rm')
      .where('rm.roomId = :roomId', { roomId })
      .andWhere('rm.role IN (:...roles)', {
        roles: [MemberRole.ADMIN, MemberRole.OWNER],
      })
      .andWhere('rm.status = :status', { status: MemberStatus.ACTIVE })
      .leftJoinAndSelect('rm.user', 'user')
      .getMany();
  }

  async countMembers(roomId: string, status?: MemberStatus): Promise<number> {
    const query = this.createQueryBuilder('rm').where('rm.roomId = :roomId', { roomId });

    if (status) {
      query.andWhere('rm.status = :status', { status });
    }

    return await query.getCount();
  }

  async findByInviteToken(token: string): Promise<RoomMember | null> {
    return await this.createQueryBuilder('rm')
      .where('rm.inviteToken = :token', { token })
      .leftJoinAndSelect('rm.user', 'user')
      .leftJoinAndSelect('rm.room', 'room')
      .getOne();
  }

  async isMember(roomId: string, userId: string): Promise<boolean> {
    const count = await this.createQueryBuilder('rm')
      .where('rm.roomId = :roomId', { roomId })
      .andWhere('rm.userId = :userId', { userId })
      .andWhere('rm.status = :status', { status: MemberStatus.ACTIVE })
      .getCount();

    return count > 0;
  }

  async findMembersByRole(roomId: string, role: MemberRole): Promise<RoomMember[]> {
    return await this.createQueryBuilder('rm')
      .where('rm.roomId = :roomId', { roomId })
      .andWhere('rm.role = :role', { role })
      .andWhere('rm.status = :status', { status: MemberStatus.ACTIVE })
      .leftJoinAndSelect('rm.user', 'user')
      .getMany();
  }

  async findRecentlyJoined(
    roomId: string,
    days: number = 7,
    skip: number = 0,
    take: number = 20,
  ): Promise<[RoomMember[], number]> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    return await this.createQueryBuilder('rm')
      .where('rm.roomId = :roomId', { roomId })
      .andWhere('rm.joinedAt >= :dateFrom', { dateFrom })
      .andWhere('rm.status = :status', { status: MemberStatus.ACTIVE })
      .leftJoinAndSelect('rm.user', 'user')
      .orderBy('rm.joinedAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
  }

  async findWithLastActivity(
    roomId: string,
    skip: number = 0,
    take: number = 20,
  ): Promise<RoomMember[]> {
    return await this.createQueryBuilder('rm')
      .where('rm.roomId = :roomId', { roomId })
      .andWhere('rm.status = :status', { status: MemberStatus.ACTIVE })
      .leftJoinAndSelect('rm.user', 'user')
      .orderBy('rm.lastActivityAt', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();
  }

  async findInactiveMembers(
    roomId: string,
    inactiveDays: number = 30,
  ): Promise<RoomMember[]> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - inactiveDays);

    return await this.createQueryBuilder('rm')
      .where('rm.roomId = :roomId', { roomId })
      .andWhere('rm.status = :status', { status: MemberStatus.ACTIVE })
      .andWhere(
        '(rm.lastActivityAt IS NULL OR rm.lastActivityAt < :dateFrom)',
        { dateFrom },
      )
      .leftJoinAndSelect('rm.user', 'user')
      .getMany();
  }
}
