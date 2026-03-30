import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModerationResultsQueryDto } from '../dto/moderation-results-query.dto';
import { OverrideModerationDto } from '../dto/override-moderation.dto';
import { AIModerationService } from '../services/ai-moderation.service';

@ApiTags('admin-moderation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/moderation')
export class AIModerationController {
  constructor(private readonly aiModerationService: AIModerationService) {}

  @Get('results')
  @ApiOperation({ summary: 'List moderation results' })
  @ApiResponse({ status: 200, description: 'Moderation results returned successfully' })
  async getResults(@Query() query: ModerationResultsQueryDto) {
    return this.aiModerationService.getResults(query);
  }

  @Patch('results/:id/override')
  @ApiOperation({ summary: 'Apply a human moderation override' })
  @ApiParam({ name: 'id', description: 'Moderation result ID' })
  @ApiResponse({ status: 200, description: 'Moderation result updated successfully' })
  async overrideResult(@Param('id') id: string, @Body() dto: OverrideModerationDto) {
    return this.aiModerationService.overrideResult(id, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get moderation statistics' })
  @ApiResponse({ status: 200, description: 'Moderation statistics returned successfully' })
  async getStats() {
    return this.aiModerationService.getModerationStats();
  }
}
