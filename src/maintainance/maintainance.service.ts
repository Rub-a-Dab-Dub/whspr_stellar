// src/maintenance/maintenance.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  MaintenanceWindow,
  MaintenanceStatus,
} from './entities/maintenance-window.entity';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceWindow)
    private readonly repo: Repository<MaintenanceWindow>,
    private readonly config: ConfigService,
    @InjectQueue('maintenance') private readonly maintenanceQueue: Queue,
  ) {}

  async listAll() {
    return this.repo.find({ order: { startAt: 'DESC' } });
  }

  async getActive() {
    return this.repo.findOne({ where: { status: MaintenanceStatus.ACTIVE } });
  }

  async create(admin: User, data: Partial<MaintenanceWindow>) {
    if (!['super_admin'].includes(admin.role)) throw new ForbiddenException();

    const window = this.repo.create({
      ...data,
      status: MaintenanceStatus.SCHEDULED,
      createdBy: admin,
    });

    const now = new Date();

    // Immediate activation
    if (window.startAt <= now) {
      window.status = MaintenanceStatus.ACTIVE;
      this.config.set('maintenance_mode', true);
    } else {
      // Schedule delayed job
      await this.maintenanceQueue.add(
        'activate',
        { id: window.id },
        { delay: window.startAt.getTime() - now.getTime() },
      );
    }

    return this.repo.save(window);
  }

  async activate(id: string) {
    const window = await this.repo.findOne({ where: { id } });
    if (!window) throw new NotFoundException();

    window.status = MaintenanceStatus.ACTIVE;
    this.config.set('maintenance_mode', true);

    return this.repo.save(window);
  }

  async end(id: string, actualEndNote?: string) {
    const window = await this.repo.findOne({ where: { id } });
    if (!window) throw new NotFoundException();
    if (window.status !== MaintenanceStatus.ACTIVE)
      throw new ForbiddenException();

    window.status = MaintenanceStatus.COMPLETED;
    window.endAt = new Date();

    this.config.set('maintenance_mode', false);

    // Broadcast webhook / WS events (pseudo code)
    // await this.webhookService.emit('platform.maintenance_end', window);
    // await this.wsGateway.emit('maintenance_end', window);

    return this.repo.save(window);
  }

  async cancel(id: string) {
    const window = await this.repo.findOne({ where: { id } });
    if (!window) throw new NotFoundException();
    if (window.status === MaintenanceStatus.ACTIVE)
      throw new ForbiddenException('Cannot cancel active window');

    window.status = MaintenanceStatus.CANCELLED;
    return this.repo.save(window);
  }
}
