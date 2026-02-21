import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  RoomInvitation,
  InvitationStatus,
} from '../entities/room-invitation.entity';

@Injectable()
export class RoomInvitationRepository extends Repository<RoomInvitation> {
  constructor(private dataSource: DataSource) {
    super(RoomInvitation, dataSource.createEntityManager());
  }

  async findPendingInvitations(
    userId: string,
    skip: number = 0,
    take: number = 20,
  ): Promise<[RoomInvitation[], number]> {
    return await this.createQueryBuilder('ri')
      .where('ri.invitedUserId = :userId', { userId })
      .andWhere('ri.status = :status', { status: InvitationStatus.PENDING })
      .andWhere('ri.expiresAt > :now', { now: new Date() })
      .leftJoinAndSelect('ri.room', 'room')
      .leftJoinAndSelect('ri.invitedBy', 'invitedBy')
      .skip(skip)
      .take(take)
      .orderBy('ri.createdAt', 'DESC')
      .getManyAndCount();
  }

  async findByToken(token: string): Promise<RoomInvitation | null> {
    return await this.createQueryBuilder('ri')
      .where('ri.inviteToken = :token', { token })
      .leftJoinAndSelect('ri.room', 'room')
      .leftJoinAndSelect('ri.invitedBy', 'invitedBy')
      .leftJoinAndSelect('ri.invitedUser', 'invitedUser')
      .getOne();
  }

  async findRoomInvitations(
    roomId: string,
    status?: InvitationStatus,
    skip: number = 0,
    take: number = 20,
  ): Promise<[RoomInvitation[], number]> {
    const query = this.createQueryBuilder('ri')
      .where('ri.roomId = :roomId', { roomId })
      .leftJoinAndSelect('ri.invitedBy', 'invitedBy')
      .leftJoinAndSelect('ri.invitedUser', 'invitedUser')
      .skip(skip)
      .take(take)
      .orderBy('ri.createdAt', 'DESC');

    if (status) {
      query.andWhere('ri.status = :status', { status });
    }

    return await query.getManyAndCount();
  }

  async findExpired(): Promise<RoomInvitation[]> {
    return await this.createQueryBuilder('ri')
      .where('ri.status = :status', { status: InvitationStatus.PENDING })
      .andWhere('ri.expiresAt < :now', { now: new Date() })
      .getMany();
  }

  async findByUserAndRoom(
    userId: string,
    roomId: string,
  ): Promise<RoomInvitation | null> {
    return await this.createQueryBuilder('ri')
      .where('ri.invitedUserId = :userId', { userId })
      .andWhere('ri.roomId = :roomId', { roomId })
      .andWhere('ri.status = :status', { status: InvitationStatus.PENDING })
      .getOne();
  }

  async findByEmail(
    email: string,
    roomId: string,
  ): Promise<RoomInvitation | null> {
    return await this.createQueryBuilder('ri')
      .where('ri.invitedEmail = :email', { email })
      .andWhere('ri.roomId = :roomId', { roomId })
      .andWhere('ri.status = :status', { status: InvitationStatus.PENDING })
      .getOne();
  }

  async countPendingInvitationsForRoom(roomId: string): Promise<number> {
    return await this.createQueryBuilder('ri')
      .where('ri.roomId = :roomId', { roomId })
      .andWhere('ri.status = :status', { status: InvitationStatus.PENDING })
      .getCount();
  }

  async countSentByUser(userId: string, since: Date): Promise<number> {
    return await this.createQueryBuilder('ri')
      .where('ri.invitedById = :userId', { userId })
      .andWhere('ri.createdAt >= :since', { since })
      .getCount();
  }

  async findAcceptedInvitationsForUser(
    userId: string,
    skip: number = 0,
    take: number = 20,
  ): Promise<[RoomInvitation[], number]> {
    return await this.createQueryBuilder('ri')
      .where('ri.invitedUserId = :userId', { userId })
      .andWhere('ri.status = :status', { status: InvitationStatus.ACCEPTED })
      .leftJoinAndSelect('ri.room', 'room')
      .leftJoinAndSelect('ri.invitedBy', 'invitedBy')
      .skip(skip)
      .take(take)
      .orderBy('ri.acceptedAt', 'DESC')
      .getManyAndCount();
  }

  async findBulkInvitations(
    roomId: string,
    inviteTokens: string[],
  ): Promise<RoomInvitation[]> {
    return await this.createQueryBuilder('ri')
      .where('ri.roomId = :roomId', { roomId })
      .andWhereInIds(inviteTokens)
      .getMany();
  }

  async deleteExpiredInvitations(daysOld: number = 30): Promise<void> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysOld);

    await this.createQueryBuilder()
      .delete()
      .where('status = :status', { status: InvitationStatus.EXPIRED })
      .andWhere('expiresAt < :dateFrom', { dateFrom })
      .execute();
  }
}
