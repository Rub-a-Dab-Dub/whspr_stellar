import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditLogService } from './audit-log.service';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { AuditLogExportDto } from './dto/audit-log-export.dto';
import { AuditLogResponseDto, PaginatedAuditLogResponseDto } from './dto/audit-log-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Replace with a real AdminGuard / RolesGuard once implemented in this project.
// Using JwtAuthGuard as a stand-in so the module compiles without additional deps.
@ApiTags('admin / audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs with optional filters' })
  @ApiResponse({ status: 200, type: PaginatedAuditLogResponseDto })
  async getLogs(@Query() filters: AuditLogFilterDto): Promise<PaginatedAuditLogResponseDto> {
    return this.auditLogService.searchLogs(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single audit log entry by ID' })
  @ApiParam({ name: 'id', description: 'Audit log entry UUID' })
  @ApiResponse({ status: 200, type: AuditLogResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getLog(@Param('id', ParseUUIDPipe) id: string): Promise<AuditLogResponseDto> {
    return this.auditLogService.findById(id);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportLogs(@Body() filters: AuditLogExportDto, @Res() res: Response): Promise<void> {
    const csv = await this.auditLogService.exportLogs(filters);
    const filename = `audit-logs-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
