import { AdminController } from './admin.controller';

describe('AdminController', () => {
  const adminService = {
    getUsers: jest.fn(),
    getUserDetail: jest.fn(),
    banUser: jest.fn(),
    unbanUser: jest.fn(),
    suspendUser: jest.fn(),
    unsuspendUser: jest.fn(),
    verifyUser: jest.fn(),
    unverifyUser: jest.fn(),
    bulkAction: jest.fn(),
    getUserActivity: jest.fn(),
    getUserSessions: jest.fn(),
    terminateSession: jest.fn(),
    terminateAllUserSessions: jest.fn(),
    getRooms: jest.fn(),
    getUserStatistics: jest.fn(),
    getAuditLogs: jest.fn(),
    exportAuditLogs: jest.fn(),
    exportUserData: jest.fn(),
    logImpersonationStart: jest.fn(),
    deleteUser: jest.fn(),
    getConfigs: jest.fn(),
    updateConfig: jest.fn(),
    getRevenueAnalytics: jest.fn(),
    getOverviewAnalytics: jest.fn(),
    getRetentionCohortAnalytics: jest.fn(),
    getLeaderboardTypes: jest.fn(),
    getLeaderboardEntries: jest.fn(),
    resetLeaderboard: jest.fn(),
    getLeaderboardHistory: jest.fn(),
    setLeaderboardPinned: jest.fn(),
    adminResetPassword: jest.fn(),
    getRoomDetails: jest.fn(),
    refundTransaction: jest.fn(),
  };
  const platformWalletService = {
    getPlatformWalletInfo: jest.fn(),
    initiateWithdrawal: jest.fn(),
    getWithdrawals: jest.fn(),
  };

  let controller: AdminController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminController(
      adminService as any,
      platformWalletService as any,
    );
  });

  it('returns health status with timestamp', async () => {
    const result = await controller.healthCheck();
    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
  });

  it('normalizes actions/adminId in getAuditLogs', async () => {
    adminService.getAuditLogs.mockResolvedValue({ logs: [], total: 0 });

    const query: any = {
      actions: 'user.banned, user.unbanned',
      actorUserId: 'ignored',
    };
    const currentUser = { userId: 'admin-1' };
    const req = {} as any;

    await controller.getAuditLogs(query, 'admin-2', currentUser, req);

    expect(adminService.getAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-2',
        actions: ['user.banned', 'user.unbanned'],
      }),
      'admin-1',
      req,
    );
  });

  it('sets headers and returns exported payload', async () => {
    adminService.exportAuditLogs.mockResolvedValue({
      contentType: 'text/csv',
      data: 'id,action\n1,user.banned',
    });

    const setHeader = jest.fn();
    const res = { setHeader } as any;

    const result = await controller.exportAuditLogs(
      { actions: 'x,y' } as any,
      'csv',
      undefined as any,
      { userId: 'admin-1' },
      {} as any,
      res,
    );

    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="audit-logs.csv"',
    );
    expect(result).toBe('id,action\n1,user.banned');
  });

  it('maps force query string for deleteUser', async () => {
    adminService.deleteUser.mockResolvedValue({ deleted: true });

    await controller.deleteUser(
      'user-1',
      { reason: 'policy', confirmEmail: 'admin@test.com' } as any,
      'true',
      { userId: 'admin-1' },
      {} as any,
    );

    expect(adminService.deleteUser).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      'admin-1',
      true,
      expect.anything(),
    );
  });

  it('coerces leaderboard history paging to numbers', async () => {
    adminService.getLeaderboardHistory.mockResolvedValue({
      items: [],
      total: 0,
    });

    await controller.getLeaderboardHistory('2' as any, '30' as any);

    expect(adminService.getLeaderboardHistory).toHaveBeenCalledWith(2, 30);
  });

  it('delegates room detail lookup with actor context', async () => {
    adminService.getRoomDetails.mockResolvedValue({ id: 'room-1' });

    await controller.getRoomDetails(
      'room-1',
      { includeMembers: true } as any,
      { userId: 'admin-1' },
      {} as any,
    );

    expect(adminService.getRoomDetails).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({ includeMembers: true }),
      'admin-1',
      expect.anything(),
    );
  });

  it('delegates user moderation endpoints', async () => {
    const currentUser = { userId: 'admin-1' };
    const req = {} as any;

    await controller.getUsers({ page: 1 } as any, currentUser, req);
    await controller.getUserDetail('u1', currentUser, req);
    await controller.banUser('u1', { reason: 'spam' } as any, currentUser, req);
    await controller.unbanUser(
      'u1',
      { reason: 'appeal accepted' } as any,
      currentUser,
      req,
    );
    await controller.suspendUser(
      'u1',
      { suspendedUntil: new Date(Date.now() + 60000).toISOString() } as any,
      currentUser,
      req,
    );
    await controller.unsuspendUser('u1', currentUser, req);
    await controller.verifyUser('u1', currentUser, req);
    await controller.unverifyUser('u1', currentUser, req);
    await controller.bulkAction(
      { userIds: ['u1'], action: 'ban', reason: 'test' } as any,
      currentUser,
      req,
    );
    await controller.getUserActivity('u1', currentUser, req);

    expect(adminService.getUsers).toHaveBeenCalledWith(
      expect.any(Object),
      'admin-1',
      req,
    );
    expect(adminService.banUser).toHaveBeenCalledWith(
      'u1',
      'admin-1',
      expect.any(Object),
      req,
    );
    expect(adminService.bulkAction).toHaveBeenCalled();
    expect(adminService.getUserActivity).toHaveBeenCalledWith(
      'u1',
      'admin-1',
      req,
    );
  });

  it('delegates session, statistics and config endpoints', async () => {
    const currentUser = { userId: 'admin-1' };
    const req = {} as any;

    await controller.getUserSessions('u1', currentUser, req);
    await controller.terminateSession('u1', 's1', currentUser, req);
    await controller.terminateAllUserSessions('u1', currentUser, req);
    await controller.getRooms({ status: 'active' } as any);
    await controller.getStatistics(currentUser, req);
    await controller.getConfigs();
    await controller.updateConfig(
      'key1',
      { value: true, reason: 'r' } as any,
      currentUser,
      req,
    );
    await controller.getRevenueAnalytics(
      { period: 'day' } as any,
      currentUser,
      req,
    );
    await controller.getOverviewAnalytics(
      { period: 'week' } as any,
      currentUser,
      req,
    );
    await controller.getRetentionAnalytics(
      { cohortPeriod: 'week', periods: 8 } as any,
      currentUser,
      req,
    );

    expect(adminService.getUserSessions).toHaveBeenCalledWith('u1');
    expect(adminService.terminateSession).toHaveBeenCalledWith(
      'u1',
      's1',
      'admin-1',
      req,
    );
    expect(adminService.getUserStatistics).toHaveBeenCalledWith('admin-1', req);
    expect(adminService.updateConfig).toHaveBeenCalledWith(
      'key1',
      expect.any(Object),
      'admin-1',
      req,
    );
    expect(adminService.getRetentionCohortAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ cohortPeriod: 'week', periods: 8 }),
      'admin-1',
      req,
    );
  });

  it('handles gdpr export, impersonation and leaderboard endpoints', async () => {
    const currentUser = { userId: 'admin-1' };
    const req = {} as any;
    const res = { setHeader: jest.fn() } as any;
    adminService.exportUserData.mockResolvedValue({ user: { id: 'u1' } });
    adminService.getUserDetail.mockResolvedValue({
      id: 'u2',
      email: 'u2@example.com',
    });

    await controller.exportGdprData('u1', currentUser, req, res);
    const impersonation = await controller.impersonateUser(
      { userId: 'u2', reason: 'support' } as any,
      currentUser,
      req,
    );
    await controller.getLeaderboardTypes();
    await controller.getLeaderboardEntries(
      'xp' as any,
      { period: 'daily' } as any,
    );
    await controller.resetLeaderboard(
      'xp' as any,
      'daily' as any,
      { reason: 'cleanup' } as any,
      currentUser,
      req,
    );
    await controller.setPinnedStatus(
      {
        userId: 'u2',
        category: 'xp',
        period: 'daily',
        isPinned: true,
      } as any,
      currentUser,
      req,
    );
    await controller.resetUserPassword('u2', currentUser, req);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json',
    );
    expect(impersonation.targetUser.id).toBe('u2');
    expect(adminService.logImpersonationStart).toHaveBeenCalledWith(
      'admin-1',
      'u2',
      req,
    );
    expect(adminService.getLeaderboardEntries).toHaveBeenCalled();
    expect(adminService.adminResetPassword).toHaveBeenCalledWith(
      'u2',
      'admin-1',
      req,
    );
  });
});
