import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookDeliveryResponseDto } from './dto/webhook-delivery-response.dto';
import { WebhookResponseDto } from './dto/webhook-response.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Create webhook' })
  @ApiResponse({ status: 201, type: WebhookResponseDto })
  createWebhook(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWebhookDto,
  ): Promise<WebhookResponseDto> {
    return this.webhooksService.createWebhook(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get webhooks' })
  @ApiResponse({ status: 200, type: WebhookResponseDto, isArray: true })
  getWebhooks(@CurrentUser('id') userId: string): Promise<WebhookResponseDto[]> {
    return this.webhooksService.getWebhooks(userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update webhook' })
  @ApiResponse({ status: 200, type: WebhookResponseDto })
  updateWebhook(
    @CurrentUser('id') userId: string,
    @Param('id') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ): Promise<WebhookResponseDto> {
    return this.webhooksService.updateWebhook(userId, webhookId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook' })
  @ApiResponse({ status: 204 })
  async deleteWebhook(
    @CurrentUser('id') userId: string,
    @Param('id') webhookId: string,
  ): Promise<void> {
    await this.webhooksService.deleteWebhook(userId, webhookId);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get webhook deliveries' })
  @ApiResponse({ status: 200, type: WebhookDeliveryResponseDto, isArray: true })
  getDeliveries(
    @CurrentUser('id') userId: string,
    @Param('id') webhookId: string,
  ): Promise<WebhookDeliveryResponseDto[]> {
    return this.webhooksService.getDeliveries(userId, webhookId);
  }
}
