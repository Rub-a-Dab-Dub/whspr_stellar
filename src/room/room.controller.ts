import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RoomSettingsService, RoomService } from './room.service';
import { UpdateRoomSettingsDto } from './dto/room-settings.dto';
import { WithdrawFundsDto } from './dto/withdraw-funds.dto';
import { RoomPaymentService } from './services/room-payment.service';
import { PayEntryDto } from './dto/pay-entry.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../roles/guards/role.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { RoleType } from '../roles/entities/role.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(private roomService: RoomService) {}

  @Post()
  async createRoom(@Body() dto: CreateRoomDto, @CurrentUser() user: any) {
    return this.roomService.createRoom(user.id, dto);
  }

  @Get(':id')
  async getRoom(@Param('id') roomId: string) {
    return this.roomService.getRoom(roomId);
  }

  @Patch(':id')
  async updateRoom(
    @Param('id') roomId: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() user: any,
  ) {
    return this.roomService.updateRoom(roomId, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoom(
    @Param('id') roomId: string,
    @CurrentUser() user: any,
  ) {
    await this.roomService.softDeleteRoom(roomId, user.id);
  }
}

@Controller('rooms/:roomId/settings')
export class RoomSettingsController {
  constructor(private settingsService: RoomSettingsService) {}

  @Get()
  async getSettings(@Param('roomId') roomId: string) {
    return this.settingsService.getOrCreateSettings(roomId);
  }

  @Patch()
  async updateSettings(
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomSettingsDto,
  ) {
    return this.settingsService.updateSettings(roomId, dto);
  }

  @Get('pinned')
  async getPinnedMessages(@Param('roomId') roomId: string) {
    return this.settingsService.getPinnedMessages(roomId);
  }

  @Post('pinned/:messageId')
  async pinMessage(
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.settingsService.pinMessage(roomId, messageId);
  }

  @Delete('pinned/:pinnedId')
  async unpinMessage(@Param('pinnedId') pinnedId: string) {
    await this.settingsService.unpinMessage(pinnedId);
    return { success: true };
  }
}

@Controller('rooms')
export class RoomPaymentController {
  constructor(private roomPaymentService: RoomPaymentService) {}

  @Post(':id/pay-entry')
  @UseGuards(JwtAuthGuard)
  async payRoomEntry(
    @Param('id') roomId: string,
    @Body() payEntryDto: PayEntryDto,
    @CurrentUser() user: any,
  ) {
    // Assuming user has a walletAddress field
    return this.roomPaymentService.payRoomEntry(
      roomId,
      user.id,
      user.walletAddress,
      payEntryDto
    );
  }

  @Get(':id/access-status')
  @UseGuards(JwtAuthGuard)
  async checkAccess(
    @Param('id') roomId: string,
    @CurrentUser() user: any,
  ) {
    return this.roomPaymentService.checkUserAccess(user.id, roomId);
  }

  @Get('payments/history')
  @UseGuards(JwtAuthGuard)
  async getPaymentHistory(
    @CurrentUser() user: any,
    @Query('roomId') roomId?: string,
  ) {
    return this.roomPaymentService.getUserPaymentHistory(user.id, roomId);
  }

  @Get('payments/:paymentId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: any,
  ) {
    return this.roomPaymentService.getPaymentStatus(paymentId, user.id);
  }

  @Post('payments/:paymentId/refund')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(RoleType.ADMIN)
  async refundPayment(
    @Param('paymentId') paymentId: string,
    @Body() refundDto: RefundPaymentDto,
    @CurrentUser() user: any,
  ) {
    refundDto.paymentId = paymentId;
    return this.roomPaymentService.refundPayment(refundDto, user.id);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  async getCreatorEarnings(@CurrentUser() user: any) {
    return this.roomPaymentService.getCreatorEarnings(user.id);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  async withdrawFunds(
    @CurrentUser() user: any,
    @Body() withdrawDto: WithdrawFundsDto,
  ) {
    return this.roomPaymentService.withdrawFunds(user.id, withdrawDto);
  }

  @Get(':id/revenue')
  @UseGuards(JwtAuthGuard)
  async getRoomRevenue(@Param('id') roomId: string) {
    return this.roomPaymentService.getRoomRevenue(roomId);
  }
}
