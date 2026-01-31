import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user && req.user.id) {
      return req.user.id; // throttle by user ID
    }
    return req.ips.length ? req.ips[0] : req.ip; // Fallback to IP if strictly needed, or maybe specific logic
  }
}
