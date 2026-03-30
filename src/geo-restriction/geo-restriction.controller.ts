import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { GeoRestrictionService } from './geo-restriction.service';
import {
  CreateGeoRestrictionDto,
  GeoRestrictionResponseDto,
  MyRestrictionsResponseDto,
} from './dto/geo-restriction.dto';
import { GeoRestriction } from './entities/geo-restriction.entity';

@Controller()
export class GeoRestrictionController {
  constructor(private readonly geoService: GeoRestrictionService) {}

  // ── Admin endpoints ────────────────────────────────────────────────────────

  /**
   * GET /admin/geo-restrictions
   * List all active geo restrictions.
   */
  @Get('admin/geo-restrictions')
  async listRestrictions(): Promise<GeoRestriction[]> {
    return this.geoService.getBlockedCountries();
  }

  /**
   * POST /admin/geo-restrictions
   * Add a new geo restriction (without redeployment).
   */
  @Post('admin/geo-restrictions')
  @HttpCode(HttpStatus.CREATED)
  async addRestriction(@Body() dto: CreateGeoRestrictionDto): Promise<GeoRestriction> {
    return this.geoService.addRestriction(dto);
  }

  /**
   * DELETE /admin/geo-restrictions/:id
   * Soft-delete (deactivate) a restriction by id.
   */
  @Delete('admin/geo-restrictions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRestriction(@Param('id') id: string): Promise<void> {
    return this.geoService.removeRestriction(id);
  }

  // ── User-facing endpoints ──────────────────────────────────────────────────

  /**
   * GET /geo/my-restrictions
   * Returns the restrictions applicable to the current request's country.
   * Country and VPN flag are resolved by GeoRestrictionMiddleware.
   */
  @Get('geo/my-restrictions')
  async getMyRestrictions(@Req() req: Request): Promise<MyRestrictionsResponseDto> {
    const country: string = (req as any).geoCountry ?? 'XX';
    const isVPN: boolean = (req as any).geoIsVPN ?? false;
    return this.geoService.getMyRestrictions(country, isVPN);
  }
}
