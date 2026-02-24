import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { XpBoostService } from '../services/xp-boost.service';
import { CreateXpBoostEventDto } from '../dto/xp-boost/create-xp-boost-event.dto';
import { UpdateXpBoostEventDto } from '../dto/xp-boost/update-xp-boost-event.dto';

@ApiTags('admin-xp-events')
@ApiBearerAuth()
@UseGuards(RoleGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/xp-events')
export class XpBoostController {
  constructor(private readonly xpBoostService: XpBoostService) {}

  @Get()
  @ApiOperation({ summary: 'List all XP boost events (past, active, scheduled)' })
  @ApiResponse({ status: 200, description: 'Array of XP boost events ordered by startAt DESC' })
  async findAll() {
    return this.xpBoostService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Get currently active XP boost event' })
  @ApiResponse({ status: 200, description: 'The active event, or null' })
  async getActive() {
    return this.xpBoostService.getActive();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new XP boost event' })
  @ApiResponse({ status: 201, description: 'XP boost event created' })
  async create(
    @Body() dto: CreateXpBoostEventDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.xpBoostService.create(dto, adminId, req);
  }

  @Patch(':eventId')
  @ApiOperation({ summary: 'Update a scheduled (not active) XP boost event' })
  @ApiParam({ name: 'eventId', description: 'XP boost event ID' })
  async update(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateXpBoostEventDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    return this.xpBoostService.update(eventId, dto, adminId, req);
  }

  @Delete(':eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a scheduled (not active or past) XP boost event' })
  @ApiParam({ name: 'eventId', description: 'XP boost event ID' })
  async remove(
    @Param('eventId') eventId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const adminId = (user?.user ?? user)?.id;
    await this.xpBoostService.remove(eventId, adminId, req);
  }
}
