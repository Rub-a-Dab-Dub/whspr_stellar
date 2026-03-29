import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ContentGatesService } from './content-gates.service';
import { CreateContentGateDto } from './dto/create-content-gate.dto';
import { VerifyContentGateDto } from './dto/verify-content-gate.dto';
import { BatchVerifyContentGatesDto } from './dto/batch-verify-content-gates.dto';
import { ContentGate, GatedContentType } from './entities/content-gate.entity';

@Controller('content-gates')
export class ContentGatesController {
  constructor(private readonly contentGates: ContentGatesService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateContentGateDto,
  ): Promise<ContentGate> {
    return this.contentGates.createGate(userId, dto);
  }

  @Post('verify/batch')
  async verifyBatch(
    @CurrentUser('id') userId: string,
    @Body() body: BatchVerifyContentGatesDto,
  ): Promise<{
    results: { contentType: GatedContentType; contentId: string; allowed: boolean }[];
  }> {
    const results = await this.contentGates.batchVerify(userId, body.items);
    return { results };
  }

  @Post('verify')
  async verify(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyContentGateDto,
  ): Promise<{ allowed: true }> {
    await this.contentGates.assertAccessOr402(userId, dto);
    return { allowed: true };
  }

  @Public()
  @Get(':contentType/:contentId')
  async listForContent(
    @Param('contentType', new ParseEnumPipe(GatedContentType)) contentType: GatedContentType,
    @Param('contentId') contentId: string,
  ) {
    return this.contentGates.getGatedContent(contentType, contentId);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.contentGates.removeGate(id, userId);
  }
}
