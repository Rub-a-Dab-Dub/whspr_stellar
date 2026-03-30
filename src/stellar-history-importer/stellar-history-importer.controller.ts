import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StellarHistoryImporterService } from './stellar-history-importer.service';
import {
  ImportStatusDto,
  TriggerImportBodyDto,
  TriggerImportResponseDto,
} from './dto/import-status.dto';

@Controller('wallets')
export class StellarHistoryImporterController {
  constructor(private readonly importerService: StellarHistoryImporterService) {}

  /**
   * POST /wallets/:id/import-history
   * Trigger a full Stellar transaction history import for the given wallet.
   */
  @Post(':id/import-history')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerImport(
    @Param('id') walletId: string,
    @Body() body: TriggerImportBodyDto,
  ): Promise<TriggerImportResponseDto> {
    const job = await this.importerService.triggerImport(walletId, body.walletAddress);
    return { jobId: job.id, message: 'History import queued successfully' };
  }

  /**
   * GET /wallets/:id/import-status
   * Return the latest import job status for the given wallet.
   */
  @Get(':id/import-status')
  async getImportStatus(@Param('id') walletId: string): Promise<ImportStatusDto> {
    return this.importerService.getImportStatus(walletId);
  }
}
