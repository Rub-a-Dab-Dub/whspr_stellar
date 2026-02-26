import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { RedisService } from '../redis/redis.service';

@Controller('users')
export class GatewayController {
  constructor(private readonly redisService: RedisService) {}

  @Get(':id/online')
  @Public()
  async isUserOnline(@Param('id') userId: string) {
    const presence = await this.redisService.hgetall(`presence:${userId}`);

    return {
      online: Object.keys(presence).length > 0,
      ...presence,
    };
  }
}
