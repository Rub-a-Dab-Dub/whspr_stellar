// src/notifications/notification-templates.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { NotificationTemplate } from './entities/notification-template.entity';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class NotificationTemplatesService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly repo: Repository<NotificationTemplate>,
  ) {}

  private validateVariables(template: NotificationTemplate) {
    const regex = /{{\s*(\w+)\s*}}/g;
    const allTokens = new Set<string>();
    [template.title, template.body].forEach((text) => {
      let match;
      while ((match = regex.exec(text))) {
        allTokens.add(match[1]);
      }
    });

    const missing = Array.from(allTokens).filter(
      (v) => !template.variables.includes(v),
    );
    if (missing.length) {
      throw new BadRequestException(
        `Missing variable declaration(s): ${missing.join(', ')}`,
      );
    }
  }

  async listAll() {
    return this.repo.find({
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(admin: User, data: Partial<NotificationTemplate>) {
    const template = this.repo.create({ ...data, createdBy: admin });
    this.validateVariables(template);
    return this.repo.save(template);
  }

  async update(templateId: string, data: Partial<NotificationTemplate>) {
    const template = await this.repo.findOne({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template not found');

    Object.assign(template, data);
    this.validateVariables(template);

    return this.repo.save(template);
  }

  async delete(templateId: string) {
    const template = await this.repo.findOne({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template not found');

    // Check if used in last 30 days (example: hypothetical Notification entity)
    const usedRecently = await this.repo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('notifications', 'n')
      .where(
        "n.templateId = :id AND n.createdAt > NOW() - INTERVAL '30 days'",
        { id: templateId },
      )
      .getRawOne();

    if (parseInt(usedRecently.count, 10) > 0) {
      throw new ForbiddenException(
        'Cannot delete template used in the last 30 days',
      );
    }

    return this.repo.remove(template);
  }

  async preview(templateId: string, variables: Record<string, string>) {
    const template = await this.repo.findOne({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template not found');

    const regex = /{{\s*(\w+)\s*}}/g;

    const interpolate = (text: string) =>
      text.replace(regex, (_, key) => {
        if (!(key in variables))
          throw new BadRequestException(`Missing variable for ${key}`);
        return variables[key];
      });

    return {
      title: interpolate(template.title),
      body: interpolate(template.body),
    };
  }
}
