import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
} from '@nestjs/common';
import { RevenueService } from './revenue.service';
import { RevenueSummaryDto } from './dto/revenue-summary.dto';
import { DistributeRevenueDto } from './dto/distribute-revenue.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Admin Revenue')
@Controller('admin/revenue')
export class RevenueController {
  constructor(private readonly service: RevenueService) {}

  @Get()
  @ApiOperation({ summary: 'Get revenue summary by period' })
  @ApiResponse({ status: 200, type: RevenueSummaryDto })
  async getRevenueSummary(
    @Query('period') period?: string,
  ): Promise<RevenueSummaryDto> {
    return this.service.getRevenueSummary(period);
  }

  @Get('distributions')
  @ApiOperation({ summary: 'Get distribution history' })
  async getDistributionHistory() {
    return this.service.getDistributionHistory();
  }

  @Post('distribute')
  @HttpCode(201)
  @ApiOperation({ summary: 'Execute fee distribution for period' })
  async distribute(@Body() dto: DistributeRevenueDto): Promise<string> {
    return this.service.executeDistribution(dto);
  }
}

