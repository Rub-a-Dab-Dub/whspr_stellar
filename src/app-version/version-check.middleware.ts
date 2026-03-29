import {
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppVersionService } from './app-version.service';
import { AppPlatform } from './entities/app-version.entity';

@Injectable()
export class VersionCheckMiddleware implements NestMiddleware {
  constructor(private readonly appVersionService: AppVersionService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (this.shouldSkip(req.path)) {
      next();
      return;
    }

    const rawVersion = req.header('X-App-Version');
    if (!rawVersion) {
      next();
      return;
    }

    const platform = this.readPlatform(req.header('X-App-Platform'));
    const compatibility = await this.appVersionService.checkCompatibility(platform, rawVersion);

    if (!compatibility) {
      next();
      return;
    }

    if (!compatibility.isSupported || compatibility.forceUpdate) {
      res.setHeader('X-Latest-Version', compatibility.latestVersion);
      res.setHeader('X-Min-Supported-Version', compatibility.minSupportedVersion);
      if (compatibility.releaseNotes) {
        res.setHeader('X-Release-Notes', compatibility.releaseNotes);
      }
      res.status(426).json({
        statusCode: 426,
        error: 'Upgrade Required',
        message: 'Please update your app to continue',
        version: compatibility,
      });
      return;
    }

    if (compatibility.softUpdate) {
      res.setHeader('X-Update-Available', 'true');
      res.setHeader('X-Latest-Version', compatibility.latestVersion);
      if (compatibility.releaseNotes) {
        res.setHeader('X-Release-Notes', compatibility.releaseNotes);
      }
    }

    next();
  }

  private shouldSkip(path: string): boolean {
    return (
      path.startsWith('/health') ||
      path.startsWith('/metrics') ||
      path.startsWith('/api/docs') ||
      path.startsWith('/docs')
    );
  }

  private readPlatform(headerValue?: string): AppPlatform {
    const normalized = headerValue?.trim().toUpperCase();
    if (normalized && normalized in AppPlatform) {
      return normalized as AppPlatform;
    }

    return AppPlatform.WEB;
  }
}
