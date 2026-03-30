import { Controller, Post, Delete, Get, Param, Body, ParseUUIDPipe, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TrustNetworkService } from './trust-network.service';
import { VouchDto, TrustResponseDto, VouchersResponseDto, VouchedResponseDto } from './dto/vouch.dto';

@ApiTags('trust-network')
@ApiBearerAuth()
@Controller('users/:id')
@UseGuards(JwtAuthGuard)
export class TrustNetworkController {
  constructor(private readonly service: TrustNetworkService) {}

  @Post('vouch')
  @ApiOperation({ summary: 'Vouch for a user (requires voucher trust >= 3.0)' })
  @ApiParam({ name: 'id', description: 'Vouched user UUID' })
  async vouch(@Req() req: any, @Param('id', ParseUUIDPipe) vouchedId: string, @Body() dto: VouchDto): Promise<void> {
    const voucherId = req.user.id;
    await this.service.vouchForUser(voucherId, vouchedId, dto);
  }

  @Delete('vouch')
  @ApiOperation({ summary: 'Revoke existing vouch' })
  @ApiParam({ name: 'id', description: 'Vouched user UUID' })
  async revokeVouch(@Req() req: any, @Param('id', ParseUUIDPipe) vouchedId: string): Promise<void> {
    const voucherId = req.user.id;
    await this.service.revokeVouch(voucherId, vouchedId);
  }

  @Get('trust')
  @ApiOperation({ summary: 'Get trust score (transitive network)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ type: TrustResponseDto })
  async getTrust(@Param('id', ParseUUIDPipe) userId: string): Promise<TrustResponseDto> {
    return this.service.getTrustScore(userId);
  }

  @Get('vouchers')
  @ApiOperation({ summary: 'Get users this user vouched for' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ type: VouchersResponseDto })
  async getVouchers(@Param('id', ParseUUIDPipe) userId: string): Promise<VouchersResponseDto> {
    return this.service.getVouchers(userId);
  }

  @Get('vouched')
  @ApiOperation({ summary: 'Get users who vouched for this user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ type: VouchedResponseDto })
  async getVouched(@Param('id', ParseUUIDPipe) userId: string): Promise<VouchedResponseDto> {
    return this.service.getVouched(userId);
  }
}
