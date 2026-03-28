import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FraudDetectionService } from './fraud-detection.service';
import { BlockIpDto } from './dto/block-ip.dto';
import { LoginHistoryQueryDto } from './dto/login-history-query.dto';
import { AnalyzeLoginDto } from './dto/analyze-login.dto';

// NOTE: add your AdminGuard / JwtAuthGuard here once your auth module is ready.
// e.g. @UseGuards(JwtAuthGuard, AdminGuard)

@ApiTags('Fraud Detection (Admin)')
@Controller('admin/fraud')
export class FraudDetectionController {
  constructor(private readonly fraudService: FraudDetectionService) {}

  // POST /admin/fraud/analyze
  // Used internally by your auth flow — and exposed here for testing
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyze a login attempt for fraud risk' })
  analyze(@Body() dto: AnalyzeLoginDto) {
    return this.fraudService.analyzeLogin(
      dto.ipAddress,
      dto.userId,
      dto.userAgent,
    );
  }

  // GET /admin/fraud/logins
  @Get('logins')
  @ApiOperation({ summary: 'Get paginated login history (all users or by userId)' })
  getLogins(@Query() query: LoginHistoryQueryDto) {
    return this.fraudService.getLoginHistory(query.userId, query.page, query.limit);
  }

  // GET /admin/fraud/blocked-ips
  @Get('blocked-ips')
  @ApiOperation({ summary: 'List all currently blocked IPs' })
  getBlockedIPs() {
    return this.fraudService.getBlockedIPs();
  }

  // POST /admin/fraud/block-ip
  @Post('block-ip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block an IP address immediately' })
  blockIP(@Body() dto: BlockIpDto) {
    return this.fraudService.blockIP(dto.ipAddress, dto.reason);
  }

  // DELETE /admin/fraud/block-ip/:ip
  @Delete('block-ip/:ip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unblock an IP address' })
  unblockIP(@Param('ip') ip: string) {
    return this.fraudService.unblockIP(ip);
  }

  // GET /admin/fraud/risk-score?ipAddress=x&userId=y
  @Get('risk-score')
  @ApiOperation({ summary: 'Get risk score for an IP (without persisting)' })
  getRiskScore(
    @Query('ipAddress') ipAddress: string,
    @Query('userId') userId?: string,
  ) {
    return this.fraudService.getRiskScore(ipAddress, userId);
  }
}