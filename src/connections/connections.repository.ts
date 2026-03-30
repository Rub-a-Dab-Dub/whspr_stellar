import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConnectionRequest, ConnectionRequestStatus } from './entities/connection-request.entity';
import { ConnectionRequestDirection } from './dto/connection.dto';
import { ProfessionalConnection } from './entities/professional-connection.entity';
import { User } from '../users/entities/user.entity';

export function canonicalPair(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}

@Injectable()
export class ConnectionsRepository {
  constructor(
    @InjectRepository(ConnectionRequest)
    private readonly requests: Repository<ConnectionRequest>,
    @InjectRepository(ProfessionalConnection)
    private readonly connections: Repository<ProfessionalConnection>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async userExists(id: string): Promise<boolean> {
    return this.users.exist({ where: { id } });
  }

  findPendingRequestBetween(senderId: string, receiverId: string): Promise<ConnectionRequest | null> {
    return this.requests.findOne({
      where: {
        senderId,
        receiverId,
        status: ConnectionRequestStatus.PENDING,
      },
    });
  }

  findConnectionRequestById(id: string): Promise<ConnectionRequest | null> {
    return this.requests.findOne({ where: { id } });
  }

  async findLatestDeclinedBetween(senderId: string, receiverId: string): Promise<ConnectionRequest | null> {
    return this.requests.findOne({
      where: {
        senderId,
        receiverId,
        status: ConnectionRequestStatus.DECLINED,
      },
      order: { respondedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  saveRequest(entity: ConnectionRequest): Promise<ConnectionRequest> {
    return this.requests.save(entity);
  }

  async listRequestsForUser(
    userId: string,
    direction: ConnectionRequestDirection,
  ): Promise<ConnectionRequest[]> {
    const qb = this.requests.createQueryBuilder('r');
    if (direction === ConnectionRequestDirection.INCOMING) {
      qb.where('r.receiverId = :uid', { uid: userId });
    } else if (direction === ConnectionRequestDirection.OUTGOING) {
      qb.where('r.senderId = :uid', { uid: userId });
    } else {
      qb.where('(r.receiverId = :uid OR r.senderId = :uid)', { uid: userId });
    }
    return qb.orderBy('r.createdAt', 'DESC').take(200).getMany();
  }

  findProfessionalConnection(userOneId: string, userTwoId: string): Promise<ProfessionalConnection | null> {
    return this.connections.findOne({ where: { userOneId, userTwoId } });
  }

  saveConnection(entity: ProfessionalConnection): Promise<ProfessionalConnection> {
    return this.connections.save(entity);
  }

  async deleteProfessionalConnection(userOneId: string, userTwoId: string): Promise<void> {
    await this.connections.delete({ userOneId, userTwoId });
  }

  /** All connection rows where the user appears on either side. */
  async findAllConnectionsForUser(userId: string): Promise<ProfessionalConnection[]> {
    return this.connections
      .createQueryBuilder('c')
      .where('c.userOneId = :uid OR c.userTwoId = :uid', { uid: userId })
      .getMany();
  }

  /**
   * Count users W (distinct from userA and userB) who have a professional connection to both userA and userB.
   */
  async countMutualProfessionals(userA: string, userB: string): Promise<number> {
    const raw = await this.dataSource.query<{ c: string }[]>(
      `
      SELECT COUNT(*)::int AS c
      FROM (
        SELECT CASE WHEN "userOneId" = $1 THEN "userTwoId" ELSE "userOneId" END AS nid
        FROM professional_connections
        WHERE "userOneId" = $1 OR "userTwoId" = $1
      ) a
      INNER JOIN (
        SELECT CASE WHEN "userOneId" = $2 THEN "userTwoId" ELSE "userOneId" END AS nid
        FROM professional_connections
        WHERE "userOneId" = $2 OR "userTwoId" = $2
      ) b ON a.nid = b.nid
      WHERE a.nid::text NOT IN ($1, $2)
      `,
      [userA, userB],
    );
    const row = raw[0];
    return row ? parseInt(String(row.c), 10) : 0;
  }

  /**
   * User IDs that have a professional connection to both `userA` and `userB`.
   */
  async listMutualProfessionalUserIds(userA: string, userB: string): Promise<string[]> {
    const raw = await this.dataSource.query<{ nid: string }[]>(
      `
      SELECT a.nid
      FROM (
        SELECT CASE WHEN "userOneId" = $1 THEN "userTwoId" ELSE "userOneId" END AS nid
        FROM professional_connections
        WHERE "userOneId" = $1 OR "userTwoId" = $1
      ) a
      INNER JOIN (
        SELECT CASE WHEN "userOneId" = $2 THEN "userTwoId" ELSE "userOneId" END AS nid
        FROM professional_connections
        WHERE "userOneId" = $2 OR "userTwoId" = $2
      ) b ON a.nid = b.nid
      WHERE a.nid::text NOT IN ($1, $2)
      `,
      [userA, userB],
    );
    return raw.map((r) => r.nid);
  }

  async refreshMutualCountsForUsers(userIds: string[]): Promise<void> {
    const unique = [...new Set(userIds)];
    for (const uid of unique) {
      const rows = await this.findAllConnectionsForUser(uid);
      for (const row of rows) {
        const other = row.userOneId === uid ? row.userTwoId : row.userOneId;
        const mc = await this.countMutualProfessionals(uid, other);
        await this.connections.update({ id: row.id }, { mutualCount: mc });
      }
    }
  }
}
