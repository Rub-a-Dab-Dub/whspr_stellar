import { AdminAccountsController } from './admin-accounts.controller';
import { UserRole } from '../../roles/entities/role.entity';

describe('AdminAccountsController', () => {
  const adminAccountService = {
    listAdmins: jest.fn(),
    inviteAdmin: jest.fn(),
    changeRole: jest.fn(),
    deactivateAdmin: jest.fn(),
    reactivateAdmin: jest.fn(),
  };

  let controller: AdminAccountsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminAccountsController(adminAccountService as any);
  });

  it('lists admins with actor id', async () => {
    adminAccountService.listAdmins.mockResolvedValue([{ id: 'admin-1' }]);
    const req = {} as any;

    const result = await controller.listAdmins({ adminId: 'super-1' }, req);

    expect(adminAccountService.listAdmins).toHaveBeenCalledWith('super-1', req);
    expect(result).toEqual([{ id: 'admin-1' }]);
  });

  it('invites admin with dto payload', async () => {
    adminAccountService.inviteAdmin.mockResolvedValue({ invited: true });
    const dto = { email: 'new-admin@test.com', role: UserRole.ADMIN } as any;
    const req = {} as any;

    await controller.inviteAdmin(dto, { adminId: 'super-1' }, req);

    expect(adminAccountService.inviteAdmin).toHaveBeenCalledWith(
      'new-admin@test.com',
      UserRole.ADMIN,
      'super-1',
      req,
    );
  });

  it('changes admin role with reason', async () => {
    adminAccountService.changeRole.mockResolvedValue({ ok: true });
    const req = {} as any;

    await controller.changeRole(
      'admin-2',
      { role: UserRole.MODERATOR, reason: 'scope update' } as any,
      { adminId: 'super-1' },
      req,
    );

    expect(adminAccountService.changeRole).toHaveBeenCalledWith(
      'admin-2',
      UserRole.MODERATOR,
      'scope update',
      'super-1',
      req,
    );
  });

  it('deactivates admin account', async () => {
    adminAccountService.deactivateAdmin.mockResolvedValue({
      deactivated: true,
    });
    const req = {} as any;

    await controller.deactivateAdmin(
      'admin-2',
      { reason: 'security' } as any,
      { adminId: 'super-1' },
      req,
    );

    expect(adminAccountService.deactivateAdmin).toHaveBeenCalledWith(
      'admin-2',
      'security',
      'super-1',
      req,
    );
  });

  it('reactivates admin account', async () => {
    adminAccountService.reactivateAdmin.mockResolvedValue({
      reactivated: true,
    });
    const req = {} as any;

    await controller.reactivateAdmin('admin-2', { adminId: 'super-1' }, req);

    expect(adminAccountService.reactivateAdmin).toHaveBeenCalledWith(
      'admin-2',
      'super-1',
      req,
    );
  });
});
