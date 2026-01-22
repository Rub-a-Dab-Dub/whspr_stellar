import { Controller, Get, Param, Post, Body, Put, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async check() {
    try {
      if (this.dataSource.isInitialized) {
          // You can also run a simple query to ensure the DB is responsive
          // await this.dataSource.query('SELECT 1');
        return { status: 'ok', database: 'connected' };
      } else {
         return { status: 'error', database: 'disconnected' };
      }
    } catch (error) {
      return { status: 'error', database: 'disconnected', message: (error as any).message };
    }
  }
}
