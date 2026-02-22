import { IpWhitelistController } from './ip-whitelist.controller';

describe('IpWhitelistController', () => {
  const ipWhitelistService = {
    findAll: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  let controller: IpWhitelistController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new IpWhitelistController(ipWhitelistService as any);
  });

  it('returns all entries', async () => {
    ipWhitelistService.findAll.mockResolvedValue([{ id: 'ip-1' }]);

    const result = await controller.getAll();

    expect(ipWhitelistService.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'ip-1' }]);
  });

  it('adds entry using forwarded ip and direct user id', async () => {
    ipWhitelistService.create.mockResolvedValue({ id: 'ip-1' });
    const req = {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.2' },
      socket: { remoteAddress: '127.0.0.1' },
    } as any;

    await controller.add(
      { ipCidr: '203.0.113.0/24', description: 'office' } as any,
      { id: 'admin-1' },
      req,
    );

    expect(ipWhitelistService.create).toHaveBeenCalledWith(
      expect.any(Object),
      'admin-1',
      '203.0.113.10',
    );
  });

  it('removes entry using x-real-ip and nested user id', async () => {
    ipWhitelistService.remove.mockResolvedValue(undefined);
    const req = {
      headers: { 'x-real-ip': '198.51.100.10' },
      socket: { remoteAddress: '127.0.0.1' },
    } as any;

    await controller.remove('entry-1', { user: { id: 'admin-2' } }, req);

    expect(ipWhitelistService.remove).toHaveBeenCalledWith(
      'entry-1',
      'admin-2',
      '198.51.100.10',
    );
  });
});
