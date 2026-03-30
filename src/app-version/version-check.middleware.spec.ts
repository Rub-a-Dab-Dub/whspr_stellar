import type { NextFunction, Request, Response } from 'express';
import { AppVersionService } from './app-version.service';
import { VersionCheckMiddleware } from './version-check.middleware';
import { AppPlatform } from './entities/app-version.entity';

describe('VersionCheckMiddleware', () => {
  let middleware: VersionCheckMiddleware;
  let service: jest.Mocked<AppVersionService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    service = {
      checkCompatibility: jest.fn(),
    } as unknown as jest.Mocked<AppVersionService>;

    middleware = new VersionCheckMiddleware(service);
    next = jest.fn();

    req = {
      path: '/api/users/me',
      header: jest.fn(),
    };

    res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('allows requests through when the header is missing', async () => {
    (req.header as jest.Mock).mockReturnValue(undefined);

    await middleware.use(req as Request, res as Response, next);

    expect(service.checkCompatibility).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('returns 426 when the client version is below minimum support', async () => {
    (req.header as jest.Mock).mockImplementation((name: string) => {
      if (name === 'X-App-Version') return '1.0.0';
      if (name === 'X-App-Platform') return AppPlatform.IOS;
      return undefined;
    });
    service.checkCompatibility.mockResolvedValue({
      platform: AppPlatform.IOS,
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      minSupportedVersion: '1.5.0',
      releaseNotes: 'Security fixes',
      updateAvailable: true,
      forceUpdate: true,
      softUpdate: false,
      isSupported: false,
    });

    await middleware.use(req as Request, res as Response, next);

    expect(service.checkCompatibility).toHaveBeenCalledWith(AppPlatform.IOS, '1.0.0');
    expect(res.status).toHaveBeenCalledWith(426);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Upgrade Required',
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches a soft update header without blocking', async () => {
    (req.header as jest.Mock).mockImplementation((name: string) => {
      if (name === 'X-App-Version') return '1.8.0';
      return undefined;
    });
    service.checkCompatibility.mockResolvedValue({
      platform: AppPlatform.WEB,
      currentVersion: '1.8.0',
      latestVersion: '2.0.0',
      minSupportedVersion: '1.5.0',
      releaseNotes: 'New dashboard',
      updateAvailable: true,
      forceUpdate: false,
      softUpdate: true,
      isSupported: true,
    });

    await middleware.use(req as Request, res as Response, next);

    expect(service.checkCompatibility).toHaveBeenCalledWith(AppPlatform.WEB, '1.8.0');
    expect(res.setHeader).toHaveBeenCalledWith('X-Update-Available', 'true');
    expect(next).toHaveBeenCalled();
  });
});
