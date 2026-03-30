import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RecurringPaymentsService } from './recurring-payments.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateRecurringPaymentDto,
  RecurringPaymentDto,
  RecurringPaymentRunDto,
} from './dto/recurring-payment.dto';

@ApiTags('recurring-payments')
@ApiBearerAuth()
@Controller('recurring-payments')
export class RecurringPaymentsController {
  constructor(private readonly service: RecurringPaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new recurring payment' })
  @ApiResponse({ status: 201, type: RecurringPaymentDto })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRecurringPaymentDto,
  ): Promise<RecurringPaymentDto> {
    return this.service.createRecurring(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all recurring payments for current user' })
  @ApiResponse({ status: 200, type: [RecurringPaymentDto] })
  list(@CurrentUser('id') userId: string): Promise<RecurringPaymentDto[]> {
    return this.service.getRecurringPayments(userId);
  }

  @Patch(':id/pause')
  @ApiOperation({ summary: 'Pause an active recurring payment' })
  @ApiResponse({ status: 200, type: RecurringPaymentDto })
  pause(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecurringPaymentDto> {
    return this.service.pauseRecurring(userId, id);
  }

  @Patch(':id/resume')
  @ApiOperation({ summary: 'Resume a paused recurring payment' })
  @ApiResponse({ status: 200, type: RecurringPaymentDto })
  resume(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecurringPaymentDto> {
    return this.service.resumeRecurring(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a recurring payment' })
  @ApiResponse({ status: 204 })
  cancel(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.cancelRecurring(userId, id);
  }

  @Get(':id/runs')
  @ApiOperation({ summary: 'Get run history for a recurring payment' })
  @ApiResponse({ status: 200, type: [RecurringPaymentRunDto] })
  runs(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecurringPaymentRunDto[]> {
    return this.service.getRunHistory(userId, id);
  }
}
