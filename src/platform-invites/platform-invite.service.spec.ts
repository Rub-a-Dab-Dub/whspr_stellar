import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { PlatformInviteRedemption } from './entities/platform-invite-redemption.entity';
import { PlatformInvite, PlatformInviteStatus } from './entities/platform-invite.entity';
import { InviteModeService } from './invite-mode.service';
import { INVITE_CODE_LENGTH, PlatformInviteService } from './platform-invite.service';

describe('PlatformInviteService', () => {
  let service: PlatformInviteService;
  let invites: any;
  let redemptions: any;
  let users: any;
  let dataSource: { transaction: jest.Mock };
  let inviteMode: jest.Mocked<Pick<InviteModeService, 'isInviteModeEnabled' | 'setInviteModeEnabled'>>;
  let mail: jest.Mocked<Pick<MailService, 'sendPlatformInviteEmail'>>;

  const adminId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(async () => {
    invites = {
      create: jest.fn((x) => Object.assign(new PlatformInvite(), x)),
      save: jest.fn(async (x) => x),
      findOne: jest.fn(),
      exist: jest.fn(),
      count: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      })),
    };

    redemptions = {
      create: jest.fn((x) => Object.assign(new PlatformInviteRedemption(), x)),
      save: jest.fn(async (x) => x),
      count: jest.fn(),
    };

    users = { find: jest.fn().mockResolvedValue([]) };

    dataSource = {
      transaction: jest.fn(async (fn: any) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === PlatformInvite) {
              return {
                findOne: invites.findOne,
                save: invites.save,
              };
            }
            if (entity === PlatformInviteRedemption) {
              return {
                create: redemptions.create,
                save: redemptions.save,
              };
            }
            return {};
          },
        };
        return fn(manager);
      }),
    };

    inviteMode = {
      isInviteModeEnabled: jest.fn(),
      setInviteModeEnabled: jest.fn(),
    };

    mail = { sendPlatformInviteEmail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformInviteService,
        { provide: getRepositoryToken(PlatformInvite), useValue: invites },
        { provide: getRepositoryToken(PlatformInviteRedemption), useValue: redemptions },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: DataSource, useValue: dataSource },
        { provide: InviteModeService, useValue: inviteMode },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(PlatformInviteService);
  });

  describe('validateInvite', () => {
    it('rejects wrong length', async () => {
      const r = await service.validateInvite('short');
      expect(r.valid).toBe(false);
    });

    it('accepts valid unused invite', async () => {
      const code = 'a'.repeat(INVITE_CODE_LENGTH);
      invites.findOne.mockResolvedValue(
        Object.assign(new PlatformInvite(), {
          code,
          status: PlatformInviteStatus.UNUSED,
          maxUses: 1,
          useCount: 0,
          expiresAt: null,
        }),
      );
      const r = await service.validateInvite(code);
      expect(r.valid).toBe(true);
      expect(r.remainingUses).toBe(1);
    });
  });

  describe('validateForRegistration', () => {
    it('returns invalid message', async () => {
      invites.findOne.mockResolvedValue(null);
      const r = await service.validateForRegistration('x'.repeat(INVITE_CODE_LENGTH));
      expect(r.valid).toBe(false);
    });
  });

  describe('setInviteMode', () => {
    it('delegates to InviteModeService', async () => {
      inviteMode.setInviteModeEnabled.mockResolvedValue(undefined);
      await expect(service.setInviteMode(true)).resolves.toEqual({ inviteModeEnabled: true });
    });
  });

  describe('revokeInvite', () => {
    it('throws when missing', async () => {
      invites.findOne.mockResolvedValue(null);
      await expect(service.revokeInvite('missing')).rejects.toThrow(NotFoundException);
    });

    it('sets REVOKED', async () => {
      const row = Object.assign(new PlatformInvite(), {
        id: 'i1',
        status: PlatformInviteStatus.UNUSED,
      });
      invites.findOne.mockResolvedValue(row);
      invites.save.mockImplementation(async (x: PlatformInvite) => x);
      await service.revokeInvite('i1');
      expect(row.status).toBe(PlatformInviteStatus.REVOKED);
    });
  });

  describe('generateInvite', () => {
    it('persists and optionally emails', async () => {
      invites.exist.mockResolvedValue(false);
      invites.save.mockImplementation(async (x: PlatformInvite) => {
        const row = x as PlatformInvite;
        row.id = row.id ?? 'new-id';
        return row;
      });
      invites.findOne.mockResolvedValue(
        Object.assign(new PlatformInvite(), {
          id: 'new-id',
          code: 'b'.repeat(INVITE_CODE_LENGTH),
          maxUses: 2,
          useCount: 0,
          status: PlatformInviteStatus.UNUSED,
          email: 't@example.com',
          createdBy: adminId,
          redemptions: [],
          createdAt: new Date(),
          expiresAt: null,
          revokedAt: null,
          lastRedeemedByUserId: null,
          lastRedeemedAt: null,
        }),
      );

      const out = await service.generateInvite(adminId, {
        email: 't@example.com',
        maxUses: 2,
      });

      expect(out.maxUses).toBe(2);
      expect(invites.save).toHaveBeenCalled();
      expect(mail.sendPlatformInviteEmail).toHaveBeenCalledWith(
        't@example.com',
        expect.any(String),
      );
    });
  });

  describe('redeemAfterRegistration', () => {
    it('increments useCount in transaction', async () => {
      const code = 'c'.repeat(INVITE_CODE_LENGTH);
      const inv = Object.assign(new PlatformInvite(), {
        id: 'inv1',
        code,
        status: PlatformInviteStatus.UNUSED,
        maxUses: 1,
        useCount: 0,
        expiresAt: null,
      });
      invites.findOne.mockResolvedValue(inv);

      await service.redeemAfterRegistration(code, adminId);

      expect(inv.useCount).toBe(1);
      expect(inv.status).toBe(PlatformInviteStatus.USED);
      expect(redemptions.save).toHaveBeenCalled();
    });

    it('allows multi-use until exhausted', async () => {
      const code = 'd'.repeat(INVITE_CODE_LENGTH);
      const inv = Object.assign(new PlatformInvite(), {
        id: 'inv2',
        code,
        status: PlatformInviteStatus.UNUSED,
        maxUses: 2,
        useCount: 0,
        expiresAt: null,
      });
      invites.findOne.mockResolvedValue(inv);

      await service.redeemAfterRegistration(code, adminId);
      expect(inv.useCount).toBe(1);
      expect(inv.status).toBe(PlatformInviteStatus.UNUSED);

      await service.redeemAfterRegistration(code, adminId);
      expect(inv.useCount).toBe(2);
      expect(inv.status).toBe(PlatformInviteStatus.USED);
    });

    it('throws when exhausted', async () => {
      const code = 'e'.repeat(INVITE_CODE_LENGTH);
      const inv = Object.assign(new PlatformInvite(), {
        id: 'inv3',
        code,
        status: PlatformInviteStatus.USED,
        maxUses: 1,
        useCount: 1,
        expiresAt: null,
      });
      invites.findOne.mockResolvedValue(inv);

      await expect(service.redeemAfterRegistration(code, adminId)).rejects.toThrow(BadRequestException);
    });

    it('throws when invite missing', async () => {
      invites.findOne.mockResolvedValue(null);
      await expect(
        service.redeemAfterRegistration('f'.repeat(INVITE_CODE_LENGTH), adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when revoked', async () => {
      const code = 'g'.repeat(INVITE_CODE_LENGTH);
      const inv = Object.assign(new PlatformInvite(), {
        id: 'inv4',
        code,
        status: PlatformInviteStatus.REVOKED,
        maxUses: 1,
        useCount: 0,
        expiresAt: null,
      });
      invites.findOne.mockResolvedValue(inv);
      await expect(service.redeemAfterRegistration(code, adminId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('isInviteModeEnabled', () => {
    it('delegates', async () => {
      inviteMode.isInviteModeEnabled.mockResolvedValue(true);
      await expect(service.isInviteModeEnabled()).resolves.toBe(true);
    });
  });

  describe('generateBulk', () => {
    it('creates count invites', async () => {
      invites.exist.mockResolvedValue(false);
      let n = 0;
      invites.save.mockImplementation(async (x: PlatformInvite) => {
        const row = x as PlatformInvite;
        row.id = `id-${n++}`;
        return row;
      });
      invites.findOne.mockImplementation(async () =>
        Object.assign(new PlatformInvite(), {
          id: `id-${n - 1}`,
          code: 'h'.repeat(INVITE_CODE_LENGTH),
          maxUses: 1,
          useCount: 0,
          status: PlatformInviteStatus.UNUSED,
          redemptions: [],
          createdAt: new Date(),
          expiresAt: null,
          revokedAt: null,
          lastRedeemedByUserId: null,
          lastRedeemedAt: null,
          createdBy: adminId,
          email: null,
        }),
      );

      const out = await service.generateBulk(adminId, { count: 3, maxUses: 1 });
      expect(out).toHaveLength(3);
    });
  });

  describe('validateInvite edge cases', () => {
    const code = 'i'.repeat(INVITE_CODE_LENGTH);

    it('marks UNUSED invite EXPIRED when past expiresAt', async () => {
      const past = new Date(Date.now() - 60_000);
      const inv = Object.assign(new PlatformInvite(), {
        code,
        status: PlatformInviteStatus.UNUSED,
        maxUses: 1,
        useCount: 0,
        expiresAt: past,
      });
      invites.findOne.mockResolvedValue(inv);
      const r = await service.validateInvite(code);
      expect(r.valid).toBe(false);
      expect(inv.status).toBe(PlatformInviteStatus.EXPIRED);
      expect(invites.save).toHaveBeenCalled();
    });

    it('rejects revoked', async () => {
      invites.findOne.mockResolvedValue(
        Object.assign(new PlatformInvite(), {
          code,
          status: PlatformInviteStatus.REVOKED,
          maxUses: 1,
          useCount: 0,
          expiresAt: null,
        }),
      );
      const r = await service.validateInvite(code);
      expect(r.valid).toBe(false);
    });

    it('rejects USED', async () => {
      invites.findOne.mockResolvedValue(
        Object.assign(new PlatformInvite(), {
          code,
          status: PlatformInviteStatus.USED,
          maxUses: 1,
          useCount: 1,
          expiresAt: null,
        }),
      );
      const r = await service.validateInvite(code);
      expect(r.valid).toBe(false);
    });

    it('rejects when uses exhausted but status still UNUSED', async () => {
      invites.findOne.mockResolvedValue(
        Object.assign(new PlatformInvite(), {
          code,
          status: PlatformInviteStatus.UNUSED,
          maxUses: 2,
          useCount: 2,
          expiresAt: null,
        }),
      );
      const r = await service.validateInvite(code);
      expect(r.valid).toBe(false);
    });
  });

  describe('validateForRegistration', () => {
    it('returns OK when valid', async () => {
      const c = 'j'.repeat(INVITE_CODE_LENGTH);
      invites.findOne.mockResolvedValue(
        Object.assign(new PlatformInvite(), {
          code: c,
          status: PlatformInviteStatus.UNUSED,
          maxUses: 1,
          useCount: 0,
          expiresAt: null,
        }),
      );
      const r = await service.validateForRegistration(c);
      expect(r.valid).toBe(true);
      expect(r.message).toBe('OK');
    });
  });

  describe('revokeInvite', () => {
    it('no-op when already REVOKED', async () => {
      const row = Object.assign(new PlatformInvite(), {
        id: 'r1',
        status: PlatformInviteStatus.REVOKED,
      });
      invites.findOne.mockResolvedValue(row);
      invites.save.mockClear();
      await service.revokeInvite('r1');
      expect(invites.save).not.toHaveBeenCalled();
    });
  });

  describe('getInvites', () => {
    it('returns paginated admin DTOs', async () => {
      const row = Object.assign(new PlatformInvite(), {
        id: 'list1',
        createdBy: adminId,
        code: 'k'.repeat(INVITE_CODE_LENGTH),
        email: null,
        status: PlatformInviteStatus.UNUSED,
        maxUses: 1,
        useCount: 0,
        expiresAt: null,
        revokedAt: null,
        lastRedeemedByUserId: null,
        lastRedeemedAt: null,
        createdAt: new Date(),
        redemptions: [],
      });
      invites.findAndCount.mockResolvedValue([[row], 1]);
      const r = await service.getInvites({ page: 1, limit: 10 });
      expect(r.items).toHaveLength(1);
      expect(r.total).toBe(1);
    });
  });

  describe('getInviteStats', () => {
    it('aggregates counts', async () => {
      inviteMode.isInviteModeEnabled.mockResolvedValue(false);
      invites.count.mockResolvedValue(4);
      invites.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([
            { status: 'UNUSED', count: '2' },
            { status: 'USED', count: '2' },
          ]),
        getCount: jest.fn().mockResolvedValue(1),
      });
      redemptions.count.mockResolvedValue(3);

      const s = await service.getInviteStats();
      expect(s.totalInvites).toBe(4);
      expect(s.byStatus.UNUSED).toBe(2);
      expect(s.byStatus.USED).toBe(2);
      expect(s.totalRedemptions).toBe(3);
      expect(s.unusedActive).toBe(1);
    });
  });

  describe('generateInvite', () => {
    it('still returns when email send fails', async () => {
      invites.exist.mockResolvedValue(false);
      invites.save.mockImplementation(async (x: PlatformInvite) => {
        const row = x as PlatformInvite;
        row.id = 'email-fail';
        return row;
      });
      invites.findOne.mockResolvedValue(
        Object.assign(new PlatformInvite(), {
          id: 'email-fail',
          code: 'm'.repeat(INVITE_CODE_LENGTH),
          maxUses: 1,
          useCount: 0,
          status: PlatformInviteStatus.UNUSED,
          redemptions: [],
          createdAt: new Date(),
          expiresAt: null,
          revokedAt: null,
          lastRedeemedByUserId: null,
          lastRedeemedAt: null,
          createdBy: adminId,
          email: 'x@example.com',
        }),
      );
      mail.sendPlatformInviteEmail.mockRejectedValue(new Error('smtp down'));

      const out = await service.generateInvite(adminId, { email: 'x@example.com' });
      expect(out.id).toBe('email-fail');
    });
  });

  describe('allocateUniqueCode', () => {
    it('throws when all candidates collide', async () => {
      invites.exist.mockResolvedValue(true);
      await expect(
        service.generateInvite(adminId, {}),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
