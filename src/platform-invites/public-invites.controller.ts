import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ValidateInviteResponseDto } from './dto/platform-invite.dto';
import { INVITE_CODE_LENGTH } from './platform-invite.service';
import { PlatformInviteService } from './platform-invite.service';

@ApiTags('invites')
@Controller('invites')
export class PublicInvitesController {
  constructor(private readonly platformInviteService: PlatformInviteService) {}

  @Public()
  @Get(':code/validate')
  @ApiOperation({ summary: 'Validate an invite code (public)' })
  validate(@Param('code') code: string): Promise<ValidateInviteResponseDto> {
    if (!code || code.length !== INVITE_CODE_LENGTH) {
      return Promise.resolve({
        valid: false,
        message: `Invite code must be ${INVITE_CODE_LENGTH} characters`,
      });
    }
    return this.platformInviteService.validateInvite(code);
  }
}
