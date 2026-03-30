import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { GeoRestrictionService, OFAC_SANCTIONED_COUNTRIES } from './geo-restriction.service';

/**
 * Resolves the client IP from common proxy headers, falling back to
 * the socket remote address.
 */
function resolveIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  return req.headers['x-real-ip'] as string ?? req.socket.remoteAddress ?? '0.0.0.0';
}

/**
 * Resolve ISO country code from the request.
 * Priority: X-Country-Code header (set by CDN/load-balancer) → fallback 'XX'.
 *
 * In production wire this to your CDN (Cloudflare CF-IPCountry,
 * AWS CloudFront CloudFront-Viewer-Country, or MaxMind GeoIP).
 */
function resolveCountry(req: Request): string {
  return (
    (req.headers['cf-ipcountry'] as string) ??
    (req.headers['x-country-code'] as string) ??
    (req.headers['cloudfront-viewer-country'] as string) ??
    'XX'
  ).toUpperCase();
}

/** Detect VPN/proxy via the X-VPN header set by upstream proxy detection. */
function detectVpn(req: Request): boolean {
  const header = req.headers['x-is-vpn'] as string | undefined;
  return header === '1' || header?.toLowerCase() === 'true';
}

@Injectable()
export class GeoRestrictionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GeoRestrictionMiddleware.name);

  constructor(private readonly geoService: GeoRestrictionService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const ip = resolveIp(req);
    const country = resolveCountry(req);
    const isVPN = detectVpn(req);

    // Attach to request so controllers/guards can read them.
    (req as any).geoCountry = country;
    (req as any).geoIp = ip;
    (req as any).geoIsVPN = isVPN;

    // Fast-path: OFAC block — no DB round-trip needed.
    if (OFAC_SANCTIONED_COUNTRIES.has(country)) {
      this.logger.warn(`OFAC block — country=${country} ip=${ip} path=${req.path}`);
      res.status(403).json({
        statusCode: 403,
        error: 'Forbidden',
        message: `Access from ${country} is not permitted under OFAC sanctions.`,
      });
      return;
    }

    // For all other countries let the request through; feature-level
    // restrictions are enforced by the GeoRestrictionGuard or service
    // at the controller/endpoint level.
    next();
  }
}
