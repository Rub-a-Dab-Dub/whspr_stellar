import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GeoRestrictionService } from '../geo-restriction.service';

export const GEO_FEATURE_KEY = 'geoFeature';

/**
 * Decorator to mark an endpoint with a feature slug for geo-based
 * feature-level restriction checks.
 *
 * @example
 * @GeoFeature('payments')
 * @Get('send')
 * async sendPayment() { ... }
 */
export const GeoFeature = (feature: string) => SetMetadata(GEO_FEATURE_KEY, feature);

/**
 * Guard that enforces FEATURE_LIMIT restrictions for the decorated feature.
 * Must be applied after GeoRestrictionMiddleware has set req.geoCountry.
 */
@Injectable()
export class GeoFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly geoService: GeoRestrictionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(GEO_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!feature) return true; // No feature restriction on this endpoint.

    const req = context.switchToHttp().getRequest();
    const country: string = req.geoCountry ?? 'XX';
    const isVPN: boolean = req.geoIsVPN ?? false;

    const result = await this.geoService.applyRestriction(country, feature, isVPN);

    if (!result.allowed) {
      throw new ForbiddenException(result.reason ?? 'Feature not available in your region.');
    }

    return true;
  }
}
