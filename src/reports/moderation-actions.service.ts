import { Injectable, Logger } from '@nestjs/common';
import { ReportTargetType } from './entities/report.entity';

@Injectable()
export class ModerationActionsService {
  private readonly logger = new Logger(ModerationActionsService.name);

  async executeTargetAction(targetType: ReportTargetType, targetId: string): Promise<void> {
    switch (targetType) {
      case ReportTargetType.MESSAGE:
        this.logger.warn(`Automated moderation deleted message ${targetId}`);
        return;
      case ReportTargetType.USER:
        this.logger.warn(`Automated moderation flagged user ${targetId}`);
        return;
      case ReportTargetType.GROUP:
        this.logger.warn(`Automated moderation flagged group ${targetId}`);
        return;
    }
  }
}
