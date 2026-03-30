import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { API_KEY_HEADER, API_KEY_PREFIX, API_KEY_SCOPES_KEY } from '../constants';
import { ApiKeysService } from '../api-keys.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);
    if (!apiKey) {
      return true;
    }

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(API_KEY_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const { apiKey: validatedKey, user } = await this.apiKeysService.validateApiKey(
      apiKey,
      requiredScopes,
    );
    await this.apiKeysService.trackUsage(validatedKey.id);

    request.user = {
      ...user,
      authMethod: 'api-key',
      apiKeyId: validatedKey.id,
      scopes: validatedKey.scopes,
    };
    request.apiKey = validatedKey;

    return true;
  }

  private extractApiKey(request: {
    headers: Record<string, string | string[] | undefined>;
  }): string | null {
    const headerValue = request.headers[API_KEY_HEADER];
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.trim();
    }

    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string') {
      return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (!token) {
      return null;
    }

    if (scheme.toLowerCase() === 'apikey') {
      return token;
    }

    if (scheme.toLowerCase() === 'bearer' && token.startsWith(API_KEY_PREFIX)) {
      return token;
    }

    return null;
  }
}
