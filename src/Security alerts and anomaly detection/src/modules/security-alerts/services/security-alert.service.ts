import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SecurityAlert,
  AlertRule,
  AlertSeverity,
  AlertStatus,
} from '../entities/security-alert.entity';

export interface AlertFilterOptions {
  severity?: AlertSeverity;
  status?: AlertStatus;
  page?: number;
  limit?: number;
}

@Injectable()
export class SecurityAlertService {
  constructor(
    @InjectRepository(SecurityAlert)
    private alertRepository: Repository<SecurityAlert>,
  ) {}

  async createAlert(alertData: {
    rule: AlertRule;
    severity: AlertSeverity;
    userId?: string;
    adminId?: string;
    details?: Record<string, any>;
  }): Promise<SecurityAlert> {
    const alert = this.alertRepository.create(
      alertData as Partial<SecurityAlert>,
    );
    return await this.alertRepository.save(alert);
  }

  async getAlerts(options: AlertFilterOptions = {}) {
    const { severity, status, page = 1, limit = 20 } = options;

    let query = this.alertRepository.createQueryBuilder('alert');

    if (severity) {
      query = query.where('alert.severity = :severity', { severity });
    }

    if (status) {
      query = query.andWhere('alert.status = :status', { status });
    }

    const total = await query.getCount();

    const alerts = await query
      .orderBy('alert.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: alerts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getAlertById(id: string): Promise<SecurityAlert | null> {
    return this.alertRepository.findOne({ where: { id } });
  }

  async updateAlert(
    id: string,
    updateData: {
      status?: AlertStatus;
      note?: string;
    },
  ): Promise<SecurityAlert> {
    const alert = await this.getAlertById(id);
    if (!alert) {
      throw new Error('Alert not found');
    }

    if (updateData.status) {
      alert.status = updateData.status;
      if (updateData.status === 'acknowledged' && !alert.acknowledgedAt) {
        alert.acknowledgedAt = new Date();
      }
      if (updateData.status === 'resolved' && !alert.resolvedAt) {
        alert.resolvedAt = new Date();
      }
    }

    if (updateData.note) {
      alert.note = updateData.note;
    }

    return this.alertRepository.save(alert);
  }

  async checkRecentAlerts(
    rule: string,
    timeWindowMs: number,
    threshold: number,
  ): Promise<number> {
    const since = new Date(Date.now() - timeWindowMs);
    const count = await this.alertRepository.count({
      where: {
        rule: rule as any,
        createdAt: new Date() as any,
      },
    });
    return count;
  }
}
