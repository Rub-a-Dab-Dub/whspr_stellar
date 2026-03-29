import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserGuard } from '../auth/guards/user.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { PortfolioService } from './portfolio.service';
import { PortfolioResponseDto, PortfolioPnLDto, PortfolioAllocationDto } from './dto/portfolio-response.dto';
import { PortfolioHistoryQueryDto } from './dto/portfolio-history-query.dto';

@ApiTags('Portfolio')
@Controller('portfolio')
@UserGuard()
@ApiBearerAuth()
export class PortfolioController {
  constructor(private readonly service: PortfolioService) {}

  @Get()
  @ApiOperation({ summary: 'Get current portfolio with USD valuation & P&L' })
  @ApiResponse({ status: 200, type: PortfolioResponseDto })
  getCurrent(@CurrentUser() user: UserResponseDto): Promise<PortfolioResponseDto> {
    return this.service.getPortfolio(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Portfolio history snapshots' })
  @ApiQuery({ name: 'limit', example: 30 })
  getHistory(
    @CurrentUser() user: UserResponseDto,
    @Query() query: PortfolioHistoryQueryDto,
  ): Promise<any> {
    return this.service.getPortfolioHistory(user.id, query);
  }

  @Get('allocation')
  @ApiOperation({ summary: 'Token allocation % breakdown' })
  @ApiResponse({ status: 200, type: PortfolioAllocationDto })
  getAllocation(@CurrentUser() user: UserResponseDto): Promise<PortfolioAllocationDto> {
    // subset of getPortfolio
    return {} as any;
  }

  @Get('pnl')
  @ApiOperation({ summary: 'P&L vs previous snapshots (24h/7d/30d)' })
  @ApiResponse({ status: 200, type: PortfolioPnLDto })
  getPnL(@CurrentUser() user: UserResponseDto): Promise<PortfolioPnLDto> {
    return this.service.getPnL(user.id);
  }
}

