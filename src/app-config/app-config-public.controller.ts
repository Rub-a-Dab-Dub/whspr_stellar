import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';
import { PublicAppConfigResponseDto } from './dto/app-config-response.dto';

@ApiTags('config')
@ApiBearerAuth()
@Controller('config')
export class AppConfigPublicController {
  constructor(private readonly service: AppConfigService) {}

  @Get('public')
  @ApiOperation({
    summary: 'Public dynamic config (authenticated users; non-sensitive keys only)',
  })
  @ApiResponse({ status: 200, type: PublicAppConfigResponseDto })
  getPublic(): Promise<PublicAppConfigResponseDto> {
    return this.service.getPublicConfig();
  }
}
