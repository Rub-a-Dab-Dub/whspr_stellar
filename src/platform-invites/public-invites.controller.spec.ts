import { Test, TestingModule } from '@nestjs/testing';
import { INVITE_CODE_LENGTH } from './platform-invite.service';
import { PlatformInviteService } from './platform-invite.service';
import { PublicInvitesController } from './public-invites.controller';

describe('PublicInvitesController', () => {
  let controller: PublicInvitesController;
  let service: { validateInvite: jest.Mock };

  beforeEach(async () => {
    service = { validateInvite: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicInvitesController],
      providers: [{ provide: PlatformInviteService, useValue: service }],
    }).compile();

    controller = module.get(PublicInvitesController);
  });

  it('returns client error shape when code length wrong without calling service', async () => {
    const r = await controller.validate('short');
    expect(r.valid).toBe(false);
    expect(r.message).toContain(String(INVITE_CODE_LENGTH));
    expect(service.validateInvite).not.toHaveBeenCalled();
  });

  it('rejects empty code without calling service', async () => {
    const r = await controller.validate('');
    expect(r.valid).toBe(false);
    expect(service.validateInvite).not.toHaveBeenCalled();
  });

  it('delegates to service for valid length', async () => {
    const code = 'a'.repeat(INVITE_CODE_LENGTH);
    service.validateInvite.mockResolvedValue({ valid: true, remainingUses: 1 });
    const r = await controller.validate(code);
    expect(r.valid).toBe(true);
    expect(service.validateInvite).toHaveBeenCalledWith(code);
  });
});
