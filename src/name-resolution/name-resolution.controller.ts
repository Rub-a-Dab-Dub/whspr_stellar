import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { NameResolutionService } from './name-resolution.service';
import { BatchResolveDto } from './dto/batch-resolve.dto';
import { ResolutionResult } from './name-resolution.types';

@Controller('resolve')
@Public()
export class NameResolutionController {
  constructor(private readonly nameResolution: NameResolutionService) {}

  @Get()
  async resolve(@Query('name') name?: string): Promise<{ resolved: ResolutionResult | null }> {
    if (!name?.trim()) {
      throw new BadRequestException('Query parameter "name" is required');
    }
    return { resolved: await this.nameResolution.resolveAny(name) };
  }

  @Get('reverse')
  async reverse(
    @Query('address') address?: string,
  ): Promise<{ primaryName: string | null }> {
    if (!address?.trim()) {
      throw new BadRequestException('Query parameter "address" is required');
    }
    return { primaryName: await this.nameResolution.reverseResolve(address) };
  }

  @Post('batch')
  async batch(
    @Body() body: BatchResolveDto,
  ): Promise<{ results: (ResolutionResult | null)[] }> {
    return { results: await this.nameResolution.resolveBatch(body.names) };
  }
}
