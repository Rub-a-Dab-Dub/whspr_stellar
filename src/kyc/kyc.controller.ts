import {
    Controller,
    Get,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
  } from '@nestjs/swagger';
  import { KycService } from './kyc.service';
  import {
    InitiateKYCDto,
    KYCWebhookDto,
    KYCStatusResponseDto,
    KYCRequirementsResponseDto,
  } from './dto/kyc.dto';
  
  @ApiTags('kyc')
  @ApiBearerAuth()
  @Controller('kyc')
  export class KycController {
    constructor(private readonly kycService: KycService) {}
  
    @Post('initiate')
    @ApiOperation({ summary: 'Initiate KYC verification' })
    @ApiResponse({ status: 201, description: 'KYC session created' })
    @ApiResponse({ status: 400, description: 'KYC already approved or in progress' })
    async initiateKYC(
      @Body() dto: InitiateKYCDto,
      // Replace with @CurrentUser() decorator from your auth module
      @Body('userId') userId: string,
    ): Promise<{ sessionToken: string; externalId: string }> {
      return this.kycService.initiateKYC(userId, dto);
    }
  
    @Get('status')
    @ApiOperation({ summary: 'Get KYC status for current user' })
    @ApiResponse({ status: 200, type: [KYCStatusResponseDto] })
    async getKYCStatus(
      @Body('userId') userId: string,
    ): Promise<KYCStatusResponseDto[]> {
      return this.kycService.getKYCStatus(userId);
    }
  
    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Handle KYC provider webhook' })
    @ApiResponse({ status: 200, description: 'Webhook processed' })
    async handleWebhook(@Body() webhookDto: KYCWebhookDto): Promise<void> {
      return this.kycService.handleWebhook(webhookDto);
    }
  
    @Get('requirements')
    @ApiOperation({ summary: 'Get KYC requirements per tier' })
    @ApiResponse({ status: 200, type: [KYCRequirementsResponseDto] })
    getKYCRequirements(): KYCRequirementsResponseDto[] {
      return this.kycService.getKYCRequirements();
    }
  
    @Post('approve/:id')
    @ApiOperation({ summary: 'Manually approve a KYC record (admin)' })
    @ApiResponse({ status: 200, description: 'KYC approved' })
    async approveKYC(@Param('id', ParseUUIDPipe) id: string) {
      return this.kycService.approveKYC(id);
    }
  
    @Post('reject/:id')
    @ApiOperation({ summary: 'Manually reject a KYC record (admin)' })
    @ApiResponse({ status: 200, description: 'KYC rejected' })
    async rejectKYC(
      @Param('id', ParseUUIDPipe) id: string,
      @Body('reason') reason: string,
    ) {
      return this.kycService.rejectKYC(id, reason);
    }
  }