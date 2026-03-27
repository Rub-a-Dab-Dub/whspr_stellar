import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PrivacyService } from './privacy.service';
import { RequestDataExportDto, DataExportResponseDto, ExportStatusResponseDto } from './dto/data-export.dto';
import { GrantConsentDto, ConsentRecordResponseDto, AllConsentsResponseDto } from './dto/consent.dto';
import { DeleteAccountDto, DeleteAccountResponseDto } from './dto/account-deletion.dto';

@ApiTags('Privacy & GDPR')
@Controller('privacy')
@ApiBearerAuth()
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Post('export')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request data export for authenticated user' })
  @ApiResponse({
    status: 201,
    description: 'Data export request created',
    type: DataExportResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Active export already exists',
  })
  async requestDataExport(
    @Request() req: any,
    @Body() _dto: RequestDataExportDto,
  ): Promise<DataExportResponseDto> {
    return this.privacyService.requestDataExport(req.user.id);
  }

  @Get('export/status')
  @ApiOperation({ summary: 'Get data export request status' })
  @ApiResponse({
    status: 200,
    description: 'Export status with progress',
    type: ExportStatusResponseDto,
  })
  async getExportStatus(
    @Request() req: any,
    @Query('exportId') exportId: string,
  ): Promise<ExportStatusResponseDto> {
    return this.privacyService.getExportStatus(exportId, req.user.id);
  }

  @Get('export/download')
  @ApiOperation({ summary: 'Get download link for ready export' })
  @ApiResponse({
    status: 200,
    description: 'Download URL with expiry',
  })
  @ApiResponse({
    status: 400,
    description: 'Export not ready or link expired',
  })
  async downloadExport(
    @Request() req: any,
    @Query('exportId') exportId: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    return this.privacyService.downloadExport(exportId, req.user.id);
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule account deletion (30-day grace period)' })
  @ApiResponse({
    status: 200,
    description: 'Account deletion scheduled',
    type: DeleteAccountResponseDto,
  })
  async deleteAccount(
    @Request() req: any,
    @Body() deleteDto: DeleteAccountDto,
  ): Promise<DeleteAccountResponseDto> {
    return this.privacyService.deleteAccount(req.user.id, deleteDto);
  }

  @Get('consents')
  @ApiOperation({ summary: 'Get user consent records (all or specific type)' })
  @ApiResponse({
    status: 200,
    description: 'Consent records',
  })
  async getConsents(
    @Request() req: any,
    @Query('type') consentType?: string,
  ): Promise<any> {
    return this.privacyService.getConsentHistory(req.user.id, consentType as any);
  }

  @Post('consents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Grant or record consent' })
  @ApiResponse({
    status: 201,
    description: 'Consent recorded',
    type: ConsentRecordResponseDto,
  })
  async recordConsent(
    @Request() req: any,
    @Body() grantDto: GrantConsentDto,
  ): Promise<ConsentRecordResponseDto> {
    const ipAddress = req.ip || req.connection.remoteAddress || undefined;
    return this.privacyService.recordConsent(req.user.id, grantDto, ipAddress);
  }

  @Patch('consents/:type')
  @ApiOperation({ summary: 'Revoke specific consent type' })
  @ApiResponse({
    status: 200,
    description: 'Consent revoked',
    type: ConsentRecordResponseDto,
  })
  async revokeConsent(
    @Request() req: any,
    @Param('type') consentType: string,
  ): Promise<ConsentRecordResponseDto> {
    return this.privacyService.revokeConsent(req.user.id, consentType as any);
  }
}
