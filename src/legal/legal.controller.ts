import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { SkipConsent } from './decorators/skip-consent.decorator';
import { LegalDocumentType } from './entities/legal-document.entity';
import { LegalService } from './legal.service';

@ApiTags('legal')
@ApiBearerAuth()
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('consents')
  @SkipConsent()
  @ApiOperation({ summary: 'Get current user consent history' })
  consentHistory(@CurrentUser() user: UserResponseDto) {
    return this.legalService.getConsentHistory(user.id);
  }

  @Get(':type')
  @Public()
  @ApiOperation({ summary: 'Get active legal document by type' })
  getActive(@Param('type') typeParam: string) {
    const type = this.parseType(typeParam);
    return this.legalService.getActiveDocument(type);
  }

  @Post(':type/accept')
  @SkipConsent()
  @ApiOperation({ summary: 'Accept the current legal document for type' })
  accept(
    @Param('type') typeParam: string,
    @CurrentUser() user: UserResponseDto,
    @Req() req: Request,
  ) {
    const type = this.parseType(typeParam);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? null;
    const ua = req.headers['user-agent'] ?? null;
    return this.legalService.recordConsent(user.id, type, ip, ua);
  }

  private parseType(typeParam: string): LegalDocumentType {
    const type = typeParam?.toUpperCase() as LegalDocumentType;
    if (!Object.values(LegalDocumentType).includes(type)) {
      throw new BadRequestException(`Unsupported legal type: ${typeParam}`);
    }
    return type;
  }
}
