import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseService, MigrationInfo } from './database.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('admin/database')
@Controller('admin/database')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DatabaseController {
  private readonly logger = new Logger(DatabaseController.name);

  constructor(private readonly databaseService: DatabaseService) {}

  @Get('migrations')
  @ApiOperation({ summary: 'Get database migration status' })
  @ApiResponse({
    status: 200,
    description: 'List of all migrations with their applied status',
  })
  async getMigrations(): Promise<MigrationInfo[]> {
    return this.databaseService.getMigrations();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get database statistics' })
  @ApiResponse({
    status: 200,
    description: 'Database statistics including table count, row count, and size',
  })
  async getDatabaseStats() {
    return this.databaseService.getDatabaseStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check database health' })
  @ApiResponse({
    status: 200,
    description: 'Database connection health status',
  })
  async healthCheck(): Promise<{ healthy: boolean }> {
    const healthy = await this.databaseService.healthCheck();
    return { healthy };
  }
}
