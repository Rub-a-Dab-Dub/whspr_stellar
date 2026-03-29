import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DidService } from './did.service';
import { RegisterDidDto } from './dto/register-did.dto';
import { UpdateDidDocumentDto } from './dto/update-did-document.dto';
import { IssueCredentialDto } from './dto/issue-credential.dto';
import { LinkCredentialDto } from './dto/link-credential.dto';
import { VerifyCredentialDto } from './dto/verify-credential.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('did')
@Controller('did')
export class DidController {
  constructor(private readonly didService: DidService) {}

  @Post('register')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a DID (did:stellar from Stellar public key, or key/web placeholder)' })
  @ApiResponse({ status: 201, description: 'DID created' })
  register(@CurrentUser('id') userId: string, @Body() dto: RegisterDidDto) {
    return this.didService.registerDID(userId, dto);
  }

  @Public()
  @Get('resolve')
  @ApiOperation({
    summary: 'Resolve DID document (W3C-style). Pass the full DID as a URL-encoded query parameter.',
  })
  @ApiQuery({ name: 'did', required: true, example: 'did:stellar:testnet:G...' })
  @ApiResponse({ status: 200, description: 'DID document JSON' })
  resolve(@Query('did') did: string) {
    if (!did?.trim()) {
      throw new BadRequestException('Query "did" is required');
    }
    return this.didService.resolveDID(did.trim());
  }

  @Patch('document')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace DID document; include did string in body' })
  updateDocument(@CurrentUser('id') userId: string, @Body() dto: UpdateDidDocumentDto) {
    if (!dto.did?.trim()) {
      throw new BadRequestException('Body must include did');
    }
    return this.didService.updateDIDDocument(userId, dto.did.trim(), dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List DIDs owned by the authenticated user' })
  getMine(@CurrentUser('id') userId: string) {
    return this.didService.getDIDByUser(userId);
  }

  @Post('credentials')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Store a verifiable credential (optionally verifies proof against issuer DID)' })
  issue(@CurrentUser('id') userId: string, @Body() dto: IssueCredentialDto) {
    return this.didService.issueCredential(userId, dto);
  }

  @Get('credentials')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List credentials for the authenticated user' })
  listCredentials(@CurrentUser('id') userId: string) {
    return this.didService.listCredentials(userId);
  }

  @Delete('credentials/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a stored credential' })
  async deleteCredential(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.didService.deleteCredential(userId, id);
  }

  @Post('credentials/verify')
  @Public()
  @ApiOperation({ summary: 'Verify a credential (signature, expiry, revocation for stored id)' })
  verify(@Body() dto: VerifyCredentialDto) {
    return this.didService.verifyCredential(dto);
  }

  @Post('credentials/:id/revoke')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a credential (fails verification afterward)' })
  revoke(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.didService.revokeCredential(userId, id);
  }

  @Post('credentials/link')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link a credential to another DID owned by the same user' })
  link(@CurrentUser('id') userId: string, @Body() dto: LinkCredentialDto) {
    return this.didService.linkCredential(userId, dto);
  }

  @Public()
  @Get('public/:userId')
  @ApiOperation({
    summary: 'Public credentials the user opted to show on profile (consent via showOnProfile)',
  })
  publicCredentials(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.didService.getPublicProfileCredentials(userId);
  }
}
