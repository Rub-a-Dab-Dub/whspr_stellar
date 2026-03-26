import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { EncryptionKeysService } from './encryption-keys.service';
import { RegisterKeyDto } from './dto/register-key.dto';
import { RotateKeyDto } from './dto/rotate-key.dto';
import { EncryptionKeyResponseDto } from './dto/encryption-key-response.dto';
import { PreKeyBundleResponseDto } from './dto/pre-key-bundle-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('encryption')
@ApiBearerAuth()
@Controller('encryption/keys')
export class EncryptionKeysController {
  constructor(private readonly encryptionKeysService: EncryptionKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new encryption public key for the authenticated user' })
  @ApiResponse({ status: 201, type: EncryptionKeyResponseDto })
  @ApiResponse({ status: 409, description: 'Active key already exists — use rotate instead' })
  registerKey(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterKeyDto,
  ): Promise<EncryptionKeyResponseDto> {
    return this.encryptionKeysService.registerKey(userId, dto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get the active encryption key for a user (for E2EE key exchange)' })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, type: EncryptionKeyResponseDto })
  @ApiResponse({ status: 404, description: 'No active key found' })
  getActiveKey(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<EncryptionKeyResponseDto> {
    return this.encryptionKeysService.getActiveKey(userId);
  }

  @Get(':userId/history')
  @ApiOperation({ summary: 'Get full key history for a user (needed for decrypting old messages)' })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, type: [EncryptionKeyResponseDto] })
  getKeyHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<EncryptionKeyResponseDto[]> {
    return this.encryptionKeysService.getKeyHistory(userId);
  }

  @Get(':userId/prekeys')
  @ApiOperation({ summary: 'Get prekey bundle for offline key exchange' })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, type: PreKeyBundleResponseDto })
  @ApiResponse({ status: 404, description: 'No prekey bundle available' })
  getPreKeyBundle(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<PreKeyBundleResponseDto> {
    return this.encryptionKeysService.getPreKeyBundle(userId);
  }

  @Post('rotate')
  @ApiOperation({ summary: 'Rotate the active encryption key (atomic deactivate old / activate new)' })
  @ApiResponse({ status: 201, type: EncryptionKeyResponseDto })
  @ApiResponse({ status: 404, description: 'No active key to rotate' })
  rotateKey(
    @CurrentUser('id') userId: string,
    @Body() dto: RotateKeyDto,
  ): Promise<EncryptionKeyResponseDto> {
    return this.encryptionKeysService.rotateKey(userId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the active encryption key for the authenticated user' })
  @ApiResponse({ status: 204, description: 'Key revoked' })
  @ApiResponse({ status: 404, description: 'No active key to revoke' })
  revokeKey(@CurrentUser('id') userId: string): Promise<void> {
    return this.encryptionKeysService.revokeKey(userId);
  }
}
