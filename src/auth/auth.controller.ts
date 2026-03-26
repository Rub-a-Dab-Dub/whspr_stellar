import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './services/auth.service';
import { ChallengeRequestDto } from './dto/challenge-request.dto';
import { ChallengeResponseDto } from './dto/challenge-response.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshRequestDto } from './dto/refresh-request.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CurrentSessionId } from '../sessions/current-session-id.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('challenge')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate authentication challenge',
    description: 'Generate a nonce for wallet signature. Challenge expires in 5 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Challenge generated successfully',
    type: ChallengeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid wallet address' })
  async generateChallenge(
    @Body() challengeRequest: ChallengeRequestDto,
  ): Promise<ChallengeResponseDto> {
    return this.authService.generateChallenge(challengeRequest.walletAddress);
  }

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify signed challenge',
    description:
      'Verify the signed challenge and issue JWT tokens. Access token expires in 15 minutes, refresh token in 30 days.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Invalid signature or expired challenge' })
  @ApiResponse({ status: 429, description: 'Too many failed attempts' })
  async verifyChallenge(
    @Body() verifyRequest: VerifyRequestDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-device-info') deviceInfo?: string,
  ): Promise<AuthResponseDto> {
    return this.authService.verifyChallenge(
      verifyRequest.walletAddress,
      verifyRequest.signature,
      ipAddress,
      userAgent,
      deviceInfo,
    );
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Use refresh token to get new access and refresh tokens. Refresh tokens are single-use.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(
    @Body() refreshRequest: RefreshRequestDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-device-info') deviceInfo?: string,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshAccessToken(
      refreshRequest.refreshToken,
      ipAddress,
      userAgent,
      deviceInfo,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout user',
    description: 'Revoke refresh token and logout user.',
  })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @CurrentUser('id') userId: string,
    @CurrentSessionId() sessionId?: string,
    @Body() _refreshRequest?: RefreshRequestDto,
  ): Promise<void> {
    await this.authService.logout(userId, sessionId);
  }
}
