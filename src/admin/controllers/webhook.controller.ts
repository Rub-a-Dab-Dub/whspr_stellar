import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RoleGuard } from '../../roles/guards/role.guard';
import { Roles } from '../../roles/decorators/roles.decorator';
import { UserRole } from '../../roles/entities/role.entity';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { WebhookService } from '../services/webhook.service';
import { CreateWebhookDto } from '../dto/webhook/create-webhook.dto';
import { UpdateWebhookDto } from '../dto/webhook/update-webhook.dto';
import { GetWebhookDeliveriesDto } from '../dto/webhook/get-webhook-deliveries.dto';

@ApiTags('admin-webhooks')
@ApiBearerAuth()
@UseGuards(RoleGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  @ApiOperation({ summary: 'List all webhook subscriptions' })
  @ApiResponse({ status: 200, description: 'List of webhook subscriptions' })
  async findAll() {
    return this.webhookService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a webhook subscription' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created. The secret is returned only once.',
  })
  async create(
    @Body() dto: CreateWebhookDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.webhookService.create(dto, adminId, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a webhook subscription' })
  @ApiParam({ name: 'id', description: 'Webhook subscription ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.webhookService.update(id, dto, adminId, req);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook subscription' })
  @ApiParam({ name: 'id', description: 'Webhook subscription ID' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    await this.webhookService.remove(id, adminId, req);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send a test ping to the webhook URL' })
  @ApiParam({ name: 'id', description: 'Webhook subscription ID' })
  @ApiResponse({ status: 200, description: 'Test result with response status and body' })
  async test(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.webhookService.testWebhook(id, adminId, req);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get paginated delivery history for a webhook subscription' })
  @ApiParam({ name: 'id', description: 'Webhook subscription ID' })
  async getDeliveries(
    @Param('id') id: string,
    @Query() query: GetWebhookDeliveriesDto,
  ) {
    return this.webhookService.getDeliveries(id, query);
  }

  @Post('deliveries/:deliveryId/retry')
  @ApiOperation({ summary: 'Manually retry a failed delivery' })
  @ApiParam({ name: 'deliveryId', description: 'Delivery ID' })
  async retryDelivery(
    @Param('deliveryId') deliveryId: string,
    @CurrentUser() user: any,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.webhookService.retryDelivery(deliveryId, adminId);
  }
}
