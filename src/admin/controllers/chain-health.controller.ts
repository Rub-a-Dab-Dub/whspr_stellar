import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { RoleGuard } from '../../roles/guards/role.guard';
import { Roles } from '../../roles/decorators/roles.decorator';
import { UserRole } from '../../roles/entities/role.entity';
import { ChainHealthService } from '../services/chain-health.service';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';

@ApiTags('admin-chains')
@ApiBearerAuth()
@UseGuards(RoleGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/chains')
export class ChainHealthController {
  constructor(private readonly chainHealthService: ChainHealthService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Current EVM chain health (read from Redis — instant, no live RPC call)',
    description:
      'Returns cached health for all configured chains. Data is refreshed every 30 seconds by the background cron job.',
  })
  @ApiResponse({ status: 200, description: 'Health map keyed by chain name' })
  async getCurrentHealth() {
    return this.chainHealthService.getCurrentHealth();
  }

  @Get('health/history')
  @ApiOperation({
    summary: 'Last 24 h of chain health check results per chain',
    description:
      'Useful for identifying recurring degradation windows. Ordered newest-first.',
  })
  @ApiQuery({
    name: 'chain',
    required: false,
    enum: SupportedChain,
    description: 'Filter results to a specific chain',
  })
  @ApiResponse({ status: 200, description: 'Array of historical health records' })
  async getHistory(@Query('chain') chain?: SupportedChain) {
    return this.chainHealthService.getHealthHistory(chain);
  }
}
