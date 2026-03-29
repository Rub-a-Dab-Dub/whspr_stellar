import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import {
  BulkGenerateInvitesDto,
  GeneratePlatformInviteDto,
  InviteStatsResponseDto,
  ListInvitesQueryDto,
  PlatformInviteAdminResponseDto,
  PlatformInviteRedemptionResponseDto,
  ValidateInviteResponseDto,
} from './dto/platform-invite.dto';
import { PlatformInviteRedemption } from './entities/platform-invite-redemption.entity';
import { PlatformInvite, PlatformInviteStatus } from './entities/platform-invite.entity';
import { InviteModeService } from './invite-mode.service';

export const INVITE_CODE_LENGTH = 16;
const CODE_ATTEMPTS = 12;

@Injectable()
export class PlatformInviteService {
  private readonly logger = new Logger(PlatformInviteService.name);

  constructor(
    @InjectRepository(PlatformInvite)
    private readonly invites: Repository<PlatformInvite>,
    @InjectRepository(PlatformInviteRedemption)
    private readonly redemptions: Repository<PlatformInviteRedemption>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly inviteMode: InviteModeService,
    private readonly mail: MailService,
  ) {}

  async isInviteModeEnabled(): Promise<boolean> {
    return this.inviteMode.isInviteModeEnabled();
  }

  async setInviteMode(enabled: boolean): Promise<{ inviteModeEnabled: boolean }> {
    await this.inviteMode.setInviteModeEnabled(enabled);
    return { inviteModeEnabled: enabled };
  }

  async generateInvite(
    createdBy: string,
    dto: GeneratePlatformInviteDto,
  ): Promise<PlatformInviteAdminResponseDto> {
    const code = await this.allocateUniqueCode();
    const maxUses = dto.maxUses ?? 1;
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const row = this.invites.create({
      createdBy,
      code,
      email: dto.email?.trim().toLowerCase() ?? null,
      status: PlatformInviteStatus.UNUSED,
      maxUses,
      useCount: 0,
      expiresAt,
      revokedAt: null,
      lastRedeemedByUserId: null,
      lastRedeemedAt: null,
    });
    const saved = await this.invites.save(row);

    if (dto.email) {
      await this.mail.sendPlatformInviteEmail(dto.email, code).catch((err) => {
        this.logger.warn(`Invite email failed for ${dto.email}: ${err}`);
      });
    }

    return this.toAdminDtoWithUsers(await this.findInviteWithRedemptions(saved.id));
  }

  async generateBulk(
    createdBy: string,
    dto: BulkGenerateInvitesDto,
  ): Promise<PlatformInviteAdminResponseDto[]> {
    const out: PlatformInviteAdminResponseDto[] = [];
    for (let i = 0; i < dto.count; i++) {
      const one = await this.generateInvite(createdBy, {
        maxUses: dto.maxUses,
        expiresAt: dto.expiresAt,
      });
      out.push(one);
    }
    return out;
  }

  async validateInvite(code: string): Promise<ValidateInviteResponseDto> {
    return this.evaluateCode(code.trim());
  }

  /** Pre-registration check (invite mode on). */
  async validateForRegistration(code: string): Promise<{ valid: boolean; message: string }> {
    const r = await this.evaluateCode(code.trim());
    return {
      valid: r.valid,
      message: r.message ?? (r.valid ? 'OK' : 'Invalid invite code'),
    };
  }

  async redeemAfterRegistration(code: string, userId: string): Promise<void> {
    const normalized = code.trim();
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PlatformInvite);
      const redRepo = manager.getRepository(PlatformInviteRedemption);

      const invite = await repo.findOne({
        where: { code: normalized },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invite) {
        throw new BadRequestException('Invite code not found');
      }

      this.assertRedeemableLocked(invite, new Date());

      invite.useCount += 1;
      invite.lastRedeemedByUserId = userId;
      invite.lastRedeemedAt = new Date();
      if (invite.useCount >= invite.maxUses) {
        invite.status = PlatformInviteStatus.USED;
      }
      await repo.save(invite);

      const redemption = redRepo.create({ inviteId: invite.id, userId });
      await redRepo.save(redemption);
    });
  }

  async revokeInvite(id: string): Promise<void> {
    const row = await this.invites.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Invite not found');
    }
    if (row.status === PlatformInviteStatus.REVOKED) {
      return;
    }
    row.status = PlatformInviteStatus.REVOKED;
    row.revokedAt = new Date();
    await this.invites.save(row);
  }

  async getInvites(query: ListInvitesQueryDto): Promise<{
    items: PlatformInviteAdminResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [rows, total] = await this.invites.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['redemptions'],
    });

    const items = await Promise.all(rows.map((r) => this.toAdminDtoWithUsers(r)));
    return { items, total, page, limit };
  }

  async getInviteStats(): Promise<InviteStatsResponseDto> {
    const inviteModeEnabled = await this.inviteMode.isInviteModeEnabled();
    const totalInvites = await this.invites.count();
    const raw = await this.invites
      .createQueryBuilder('i')
      .select('i.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('i.status')
      .getRawMany<{ status: string; count: string }>();

    const byStatus: Record<string, number> = {};
    for (const r of raw) {
      byStatus[r.status] = parseInt(r.count, 10);
    }

    const totalRedemptions = await this.redemptions.count();
    const now = new Date();
    const unusedActive = await this.invites
      .createQueryBuilder('i')
      .where('i.status = :unused', { unused: PlatformInviteStatus.UNUSED })
      .andWhere('(i.expiresAt IS NULL OR i.expiresAt > :now)', { now })
      .getCount();

    return {
      inviteModeEnabled,
      totalInvites,
      byStatus,
      totalRedemptions,
      unusedActive,
    };
  }

  private async evaluateCode(code: string): Promise<ValidateInviteResponseDto> {
    if (!code || code.length !== INVITE_CODE_LENGTH) {
      return { valid: false, message: 'Invite code must be 16 characters' };
    }

    const invite = await this.invites.findOne({ where: { code } });
    if (!invite) {
      return { valid: false, message: 'Unknown invite code' };
    }

    const now = new Date();
    if (invite.expiresAt && invite.expiresAt <= now) {
      if (invite.status !== PlatformInviteStatus.EXPIRED) {
        invite.status = PlatformInviteStatus.EXPIRED;
        await this.invites.save(invite);
      }
      return { valid: false, message: 'This invite has expired', expiresAt: invite.expiresAt.toISOString() };
    }

    if (invite.status === PlatformInviteStatus.REVOKED) {
      return { valid: false, message: 'This invite has been revoked' };
    }

    if (invite.status === PlatformInviteStatus.EXPIRED) {
      return { valid: false, message: 'This invite has expired' };
    }

    if (invite.status === PlatformInviteStatus.USED) {
      return { valid: false, message: 'This invite has been fully used' };
    }

    if (invite.useCount >= invite.maxUses) {
      return { valid: false, message: 'This invite has no remaining uses' };
    }

    return {
      valid: true,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      remainingUses: invite.maxUses - invite.useCount,
    };
  }

  private assertRedeemableLocked(invite: PlatformInvite, now: Date): void {
    if (invite.status === PlatformInviteStatus.REVOKED) {
      throw new BadRequestException('This invite has been revoked');
    }
    if (invite.status === PlatformInviteStatus.EXPIRED) {
      throw new BadRequestException('This invite has expired');
    }
    if (invite.expiresAt && invite.expiresAt <= now) {
      throw new BadRequestException('This invite has expired');
    }
    if (invite.status === PlatformInviteStatus.USED) {
      throw new BadRequestException('This invite has been fully used');
    }
    if (invite.useCount >= invite.maxUses) {
      throw new BadRequestException('This invite has no remaining uses');
    }
  }

  private async allocateUniqueCode(): Promise<string> {
    for (let a = 0; a < CODE_ATTEMPTS; a++) {
      const code = randomBytes(12).toString('base64url').slice(0, INVITE_CODE_LENGTH);
      if (code.length < INVITE_CODE_LENGTH) {
        continue;
      }
      const taken = await this.invites.exist({ where: { code } });
      if (!taken) {
        return code;
      }
    }
    throw new ServiceUnavailableException('Could not allocate a unique invite code');
  }

  private async findInviteWithRedemptions(id: string): Promise<PlatformInvite> {
    const row = await this.invites.findOne({
      where: { id },
      relations: ['redemptions'],
    });
    if (!row) {
      throw new NotFoundException('Invite not found');
    }
    return row;
  }

  private async toAdminDtoWithUsers(row: PlatformInvite): Promise<PlatformInviteAdminResponseDto> {
    const redemptions = row.redemptions ?? [];
    const userIds = [...new Set(redemptions.map((r) => r.userId))];
    const users =
      userIds.length > 0
        ? await this.users.find({ where: { id: In(userIds) } })
        : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    const redDtos: PlatformInviteRedemptionResponseDto[] = redemptions.map((r) => {
      const u = byId.get(r.userId);
      return {
        id: r.id,
        userId: r.userId,
        redeemedAt: r.redeemedAt.toISOString(),
        redeemerUsername: u?.username ?? null,
        redeemerWallet: u?.walletAddress ?? null,
        redeemerEmail: u?.email ?? null,
      };
    });

    return {
      id: row.id,
      createdBy: row.createdBy,
      code: row.code,
      email: row.email,
      status: row.status,
      maxUses: row.maxUses,
      useCount: row.useCount,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      lastRedeemedByUserId: row.lastRedeemedByUserId,
      lastRedeemedAt: row.lastRedeemedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      redemptions: redDtos,
    };
  }

}
