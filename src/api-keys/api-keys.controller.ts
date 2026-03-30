import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { API_KEY_HEADER } from './constants';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyResponseDto, CreatedApiKeyResponseDto } from './dto/api-key-response.dto';

@ApiTags('api-keys')
@ApiBearerAuth()
@ApiHeader({
  name: API_KEY_HEADER,
  required: false,
  description: 'Optional API key header for programmatic authentication',
})
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new API key for the authenticated user' })
  @ApiResponse({ status: 201, type: CreatedApiKeyResponseDto })
  createApiKey(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateApiKeyDto,
  ): Promise<CreatedApiKeyResponseDto> {
    return this.apiKeysService.createApiKey(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List API keys for the authenticated user' })
  @ApiResponse({ status: 200, type: ApiKeyResponseDto, isArray: true })
  getApiKeys(@CurrentUser('id') userId: string): Promise<ApiKeyResponseDto[]> {
    return this.apiKeysService.getApiKeys(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key owned by the authenticated user' })
  @ApiResponse({ status: 200 })
  async revokeApiKey(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true }> {
    await this.apiKeysService.revokeApiKey(userId, id);
    return { success: true };
  }

  @Post(':id/rotate')
  @ApiOperation({ summary: 'Rotate an API key owned by the authenticated user' })
  @ApiResponse({ status: 201, type: CreatedApiKeyResponseDto })
  rotateApiKey(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CreatedApiKeyResponseDto> {
    return this.apiKeysService.rotateApiKey(userId, id);
  }
}
