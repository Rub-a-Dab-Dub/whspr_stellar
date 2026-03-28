import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { SkipConsent } from './decorators/skip-consent.decorator';
import { CreateLegalDocumentDto } from './dto/legal-document.dto';
import { LegalDocumentType } from './entities/legal-document.entity';
import { LegalService } from './legal.service';

@ApiTags('legal')
@ApiBearerAuth()
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  // ── Public document endpoints ──────────────────────────────────────────────

  @Get('documents')
  @Public()
  @ApiOperation({ summary: 'Get all active legal documents' })
  getAllActive() {
    return this.legalService.getAllActiveDocuments();
  }

  @Get('documents/:type')
  @Public()
  @ApiOperation({ summary: 'Get the active document for a given type' })
  @ApiQuery({ name: 'type', enum: LegalDocumentType })
  getActive(@Param('type') type: LegalDocumentType) {
    return this.legalService.getActiveDocument(type);
  }

  // ── Consent endpoints (authenticated, skip consent check so users can accept) ──

  @Post('documents/:id/accept')
  @SkipConsent()
  @ApiOperation({ summary: 'Accept a legal document' })
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserResponseDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? null;
    const ua = req.headers['user-agent'] ?? null;
    return this.legalService.recordConsent(user.id, id, ip, ua);
  }

  @Get('documents/:id/consent-status')
  @SkipConsent()
  @ApiOperation({ summary: 'Check if the current user has accepted a document' })
  consentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserResponseDto,
  ) {
    return this.legalService.checkConsent(user.id, id);
  }

  @Get('consent-history')
  @SkipConsent()
  @ApiOperation({ summary: 'Get the current user consent history' })
  consentHistory(@CurrentUser() user: UserResponseDto) {
    return this.legalService.getConsentHistory(user.id);
  }

  // ── Admin endpoints ────────────────────────────────────────────────────────

  @Post('admin/documents')
  @ApiOperation({ summary: '[Admin] Create a draft legal document' })
  createDraft(
    @Body() dto: CreateLegalDocumentDto,
    @CurrentUser() user: UserResponseDto,
  ) {
    return this.legalService.createDraft(dto, user.id);
  }

  @Post('admin/documents/:id/publish')
  @ApiOperation({ summary: '[Admin] Publish a draft legal document' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserResponseDto,
  ) {
    return this.legalService.publishDocument(id, user.id);
  }
}
