import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SessionKeyService } from './session-keys.service';
import {
  CreateSessionKeyDto,
  ListSessionKeysQueryDto,
} from './dto/session-key.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('session-keys')
@ApiBearerAuth()
@Controller('auth/session-keys')
export class SessionKeyController {
  constructor(private readonly sessionKeyService: SessionKeyService) {}

  /**
   * POST /auth/session-keys
   * Register a new delegated session key for the authenticated user.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new session key',
    description:
      'Creates a session key that allows the platform paymaster to submit ' +
      "transactions on the user's behalf within the specified scope and limits.",
  })
  @ApiResponse({
    status: 201,
    description: 'Session key registered successfully',
    schema: {
      example: {
        id: 'uuid',
        userId: 'uuid',
        publicKey: 'GBVVBB...',
        expiresAt: '2025-12-31T23:59:59.000Z',
        scope: ['tip'],
        spendingLimitPerTx: '100.00',
        totalSpendingLimit: '1000.00',
        totalSpentAmount: '0.00000000',
        label: 'Mobile dApp',
        isRevoked: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or invalid expiry',
  })
  @ApiResponse({ status: 409, description: 'Public key already registered' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSessionKeyDto,
  ) {
    return this.sessionKeyService.create(user.sub, dto);
  }

  /**
   * DELETE /auth/session-keys/:id
   * Revoke a session key owned by the authenticated user.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke a session key',
    description:
      'Immediately invalidates the session key. In-flight transactions using ' +
      'this key will fail on the next validation check.',
  })
  @ApiParam({ name: 'id', description: 'Session key UUID' })
  @ApiResponse({ status: 204, description: 'Revoked successfully' })
  @ApiResponse({ status: 403, description: 'Key belongs to another user' })
  @ApiResponse({ status: 404, description: 'Key not found' })
  async revoke(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.sessionKeyService.revoke(id, user.sub);
  }

  /**
   * GET /auth/session-keys
   * List active session keys for the authenticated user.
   */
  @Get()
  @ApiOperation({
    summary: 'List session keys',
    description:
      'Returns active (non-revoked, non-expired) session keys. ' +
      'Pass includeRevoked=true to include revoked and expired keys.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session keys returned',
    schema: {
      example: {
        data: [],
        total: 0,
      },
    },
  })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListSessionKeysQueryDto,
  ) {
    const keys = await this.sessionKeyService.list(
      user.sub,
      query.includeRevoked ?? false,
    );
    return { data: keys, total: keys.length };
  }
}
