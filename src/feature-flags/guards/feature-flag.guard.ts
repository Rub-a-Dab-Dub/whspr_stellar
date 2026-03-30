import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../feature-flags.service';
import { FEATURE_FLAG_METADATA_KEY } from '../decorators/feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!flagKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string; tier?: string } | undefined;

    const enabled = user?.id
      ? await this.featureFlagsService.isEnabledForUser(flagKey, user.id, user.tier)
      : await this.featureFlagsService.isEnabled(flagKey);

    if (!enabled) {
      throw new ForbiddenException(`Feature flag "${flagKey}" is disabled`);
    }

    return true;
  }
}
