import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { RoomStats } from '../entities/room-stats.entity';
import { StatsPeriod } from '../dto/get-room-stats.dto';

@Injectable()
export class RoomStatsService {
  private roomConnections: Map<string, Set<string>> = new Map();
  private hourSenders: Map<string, Set<string>> = new Map();

  constructor(
    @InjectRepository(RoomStats)
    private statsRepo: Repository<RoomStats>,
  ) {}

  async trackMessage(roomId: string, userId: string, tipAmount: bigint = BigInt(0)) {
    const hourBucket = this.getHourBucket(new Date());
    const key = `${roomId}:${hourBucket.getTime()}`;
    
    if (!this.hourSenders.has(key)) {
      this.hourSenders.set(key, new Set());
    }
    this.hourSenders.get(key)!.add(userId);

    let stats = await this.statsRepo.findOne({
      where: { roomId, periodStart: hourBucket },
    });

    if (!stats) {
      stats = this.statsRepo.create({ roomId, periodStart: hourBucket });
    }

    stats.messageCount += 1;
    stats.uniqueSenders = this.hourSenders.get(key)!.size;
    
    if (tipAmount > BigInt(0)) {
      const currentTip = parseFloat(stats.tipVolume || '0');
      const newTip = parseFloat(tipAmount.toString()) / 10000000;
      stats.tipVolume = (currentTip + newTip).toString();
    }

    await this.statsRepo.save(stats);
  }

  async updatePeakConcurrent(roomId: string) {
    const hourBucket = this.getHourBucket(new Date());
    const concurrent = this.roomConnections.get(roomId)?.size || 0;

    let stats = await this.statsRepo.findOne({
      where: { roomId, periodStart: hourBucket },
    });

    if (!stats) {
      stats = this.statsRepo.create({ roomId, periodStart: hourBucket, peakConcurrent: concurrent });
    } else if (concurrent > stats.peakConcurrent) {
      stats.peakConcurrent = concurrent;
    }

    await this.statsRepo.save(stats);
  }

  addConnection(roomId: string, userId: string) {
    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set());
    }
    this.roomConnections.get(roomId)!.add(userId);
    this.updatePeakConcurrent(roomId);
  }

  removeConnection(roomId: string, userId: string) {
    this.roomConnections.get(roomId)?.delete(userId);
  }

  async getRoomStats(roomId: string, period: StatsPeriod) {
    const since = this.getPeriodStart(period);
    const stats = await this.statsRepo.find({
      where: { roomId, periodStart: MoreThanOrEqual(since) },
      order: { periodStart: 'ASC' },
    });

    const totalMessages = stats.reduce((sum, s) => sum + s.messageCount, 0);
    const totalTips = stats.reduce((sum, s) => sum + parseFloat(s.tipVolume || '0'), 0);
    const maxPeak = Math.max(...stats.map(s => s.peakConcurrent), 0);
    const totalUnique = stats.reduce((sum, s) => sum + s.uniqueSenders, 0);

    return {
      period,
      totalMessages,
      uniqueSenders: totalUnique,
      totalTips: totalTips.toFixed(7),
      peakConcurrent: maxPeak,
      hourlyStats: stats,
    };
  }

  async getTrendingScore(roomId: string): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stats = await this.statsRepo.find({
      where: { roomId, periodStart: MoreThanOrEqual(since) },
    });

    const messageCount = stats.reduce((sum, s) => sum + s.messageCount, 0);
    const uniqueSenders = stats.reduce((sum, s) => sum + s.uniqueSenders, 0);

    return messageCount * 0.6 + uniqueSenders * 0.4;
  }

  async getCreatorDashboard(creatorId: string, roomIds: string[]) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const allStats = [];
    for (const roomId of roomIds) {
      const stats = await this.statsRepo.find({
        where: { roomId, periodStart: MoreThanOrEqual(since) },
      });
      allStats.push(...stats);
    }

    const totalEarnings = allStats.reduce((sum, s) => sum + parseFloat(s.tipVolume || '0'), 0);
    const totalMessages = allStats.reduce((sum, s) => sum + s.messageCount, 0);

    return {
      totalEarnings: totalEarnings.toFixed(7),
      totalMessages,
      roomCount: roomIds.length,
    };
  }

  private getHourBucket(date: Date): Date {
    const bucket = new Date(date);
    bucket.setMinutes(0, 0, 0);
    return bucket;
  }

  private getPeriodStart(period: StatsPeriod): Date {
    const now = Date.now();
    switch (period) {
      case StatsPeriod.HOURS_24:
        return new Date(now - 24 * 60 * 60 * 1000);
      case StatsPeriod.DAYS_7:
        return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case StatsPeriod.DAYS_30:
        return new Date(now - 30 * 24 * 60 * 60 * 1000);
    }
  }
}
