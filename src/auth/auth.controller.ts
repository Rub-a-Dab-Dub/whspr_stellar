import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { NonceRequestDto, VerifySignatureDto, RefreshTokenDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/nonce
   * Generate a one-time nonce for the given wallet address.
   * Public — no authentication required.
   */
  @Public()
  @Post('nonce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a one-time nonce for wallet authentication',
    description:
      'Returns a nonce and the exact message the wallet must sign. ' +
      'The nonce expires after 5 minutes. Use eth_sign or personal_sign in MetaMask.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nonce generated successfully',
    schema: {
      example: {
        nonce: 'a3f8c1d2...',
        message: 'Welcome to Whspr!\n\nSign this message...',
      },
    },
  })
  async getNonce(@Body() dto: NonceRequestDto) {
    return this.authService.generateNonce(dto.walletAddress);
  }

  /**
   * POST /auth/verify
   * Verify the signed nonce and issue access + refresh tokens.
   * Public — this is the authentication endpoint itself.
   */
  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a signed nonce and issue JWT tokens',
    description:
      'Verifies the EIP-191 signature using ethers.js verifyMessage(). ' +
      'On success, returns a short-lived access token and a 7-day refresh token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    schema: {
      example: {
        accessToken: 'eyJhbGci...',
        refreshToken: 'eyJhbGci...',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid signature or expired nonce' })
  async verify(@Body() dto: VerifySignatureDto) {
    return this.authService.verifySignature(dto.walletAddress, dto.signature);
  }

  /**
   * POST /auth/refresh
   * Exchange a valid refresh token for a new access + refresh token pair.
   * Public — the refresh token IS the authentication credential here.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token using a refresh token',
    description:
      'Rotates the refresh token (old token is invalidated on use). ' +
      'Returns a new access token and refresh token.',
  })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or revoked refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  /**
   * DELETE /auth/logout
   * Invalidate the refresh token for the authenticated user.
   * Requires a valid access token (guarded by global JwtAuthGuard).
   */
  @Delete('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout and invalidate refresh token',
    description:
      'Revokes the stored refresh token. The access token expires naturally after its TTL.',
  })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.authService.logout(user.sub);
  }
}