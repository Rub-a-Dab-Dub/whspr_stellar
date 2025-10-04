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
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { XPTransactionService } from './xp-transaction.service';
import { CreateXPTransactionDto } from './dto/create-xp-transaction.dto';
import { UpdateXPTransactionDto } from './dto/update-xp-transaction.dto';
import { VoidXPTransactionDto } from './dto/void-xp-transaction.dto';
import { QueryXPTransactionDto } from './dto/query-xp-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('XP Transactions (Admin)')
@ApiBearerAuth()
@Controller('admin/xp-transactions')
@UseGuards(JwtAuthGuard, AdminGuard)
export class XPTransactionController {
  constructor(private readonly xpService: XPTransactionService) {}

  @Post()
  @ApiOperation({
    summary: 'Create manual XP award',
    description: 'Award XP manually for events with optional multipliers',
  })
  @ApiResponse({ status: 201, description: 'XP transaction created successfully' })
  async create(@Body() dto: CreateXPTransactionDto) {
    return this.xpService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated XP transactions' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async findAll(@Query() query: QueryXPTransactionDto) {
    return this.xpService.findAll(query);
  }

  @Get('aggregates')
  @ApiOperation({ summary: 'Get XP aggregates and statistics' })
  async getAggregates(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.xpService.getAggregates(startDate, endDate);
  }

  @Get('user/:userId/total')
  @ApiOperation({ summary: 'Get total XP for a user' })
  async getUserTotal(@Param('userId') userId: string) {
    const total = await this.xpService.getUserTotal(userId);
    return { userId, totalXP: total };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export XP transactions to CSV' })
  async exportCSV(
    @Query() query: QueryXPTransactionDto,
    @Query('anonymize') anonymize: string,
    @Res() res: Response,
  ) {
    const shouldAnonymize = anonymize === 'true';
    const data = await this.xpService.exportToCSV(query, shouldAnonymize);

    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map((row) =>
        Object.values(row)
          .map((v) => `"${v}"`)
          .join(','),
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=xp-transactions.csv');
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get XP transaction by ID' })
  async findOne(@Param('id') id: string) {
    return this.xpService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Retroactively adjust XP' })
  async update(@Param('id') id: string, @Body() dto: UpdateXPTransactionDto) {
    return this.xpService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void fraudulent XP transaction' })
  async void(@Param('id') id: string, @Body() dto: VoidXPTransactionDto) {
    return this.xpService.void(id, dto);
  }
}
