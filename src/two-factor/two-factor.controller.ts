import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Post,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthService } from '../auth/services/auth.service';
import { TwoFactorBackupCodesMetaDto } from './dto/two-factor-backup-codes-meta.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';
import { TwoFactorEnableResponseDto } from './dto/two-factor-enable-response.dto';
import { TwoFactorRegenerateResponseDto } from './dto/two-factor-regenerate-response.dto';
import { TwoFactorSetupResponseDto } from './dto/two-factor-setup-response.dto';
import { TwoFactorVerifyLoginDto } from './dto/two-factor-verify-login.dto';
import { TwoFactorAuthGuard } from './guards/two-factor-auth.guard';
import { TwoFactorService } from './two-factor.service';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';

@ApiTags('two-factor')
@Controller('2fa')
export class TwoFactorController {
  constructor(
    private readonly twoFactorService: TwoFactorService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  @Post('setup')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start TOTP setup (returns otpauth URI for authenticator apps)' })
  @ApiResponse({ status: 200, type: TwoFactorSetupResponseDto })
  setup(@CurrentUser('id') userId: string): Promise<TwoFactorSetupResponseDto> {
    return this.twoFactorService.setup(userId);
  }

  @Post('enable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm TOTP and enable 2FA (returns one-time backup codes)' })
  @ApiResponse({ status: 200, type: TwoFactorEnableResponseDto })
  enable(
    @CurrentUser('id') userId: string,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<TwoFactorEnableResponseDto> {
    return this.twoFactorService.enable(userId, dto.code);
  }

  @Post('disable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disable 2FA (requires valid TOTP or backup code)' })
  async disable(
    @CurrentUser('id') userId: string,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<void> {
    await this.twoFactorService.disable(userId, dto.code);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login after wallet signature when 2FA is enabled' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  verifyLogin(
    @Body() dto: TwoFactorVerifyLoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-device-info') deviceInfo?: string,
  ): Promise<AuthResponseDto> {
    return this.authService.completeTwoFactorLogin(
      dto.pendingToken,
      dto.code,
      ipAddress,
      userAgent,
      deviceInfo,
    );
  }

  @Get('backup-codes')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Number of unused backup codes remaining' })
  @ApiResponse({ status: 200, type: TwoFactorBackupCodesMetaDto })
  async getBackupCodesMeta(
    @CurrentUser('id') userId: string,
  ): Promise<TwoFactorBackupCodesMetaDto> {
    return this.twoFactorService.getBackupCodesMeta(userId);
  }

  @Post('backup-codes/regenerate')
  @ApiBearerAuth()
  @UseGuards(TwoFactorAuthGuard)
  @ApiHeader({
    name: TwoFactorAuthGuard.headerName,
    required: true,
    description: 'Valid TOTP or unused backup code',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate backup codes (requires 2FA code in header)' })
  @ApiResponse({ status: 200, type: TwoFactorRegenerateResponseDto })
  regenerateBackupCodes(
    @CurrentUser('id') userId: string,
  ): Promise<TwoFactorRegenerateResponseDto> {
    return this.twoFactorService.regenerateBackupCodes(userId);
  }
}
