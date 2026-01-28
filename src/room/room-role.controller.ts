import {
    Controller,
    Post,
    Delete,
    Get,
    Body,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoomRoleService } from './services/room-role.service';
import { SetRoomRoleDto } from './dto/set-room-role.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { WhitelistUserDto } from './dto/whitelist-user.dto';
import { EmergencyPauseDto } from './dto/emergency-pause.dto';

@Controller('rooms/:roomId/roles')
@UseGuards(JwtAuthGuard)
export class RoomRoleController {
    constructor(private readonly roomRoleService: RoomRoleService) { }

    /**
     * Set a user's role in the room
     */
    @Post('set-role')
    @HttpCode(HttpStatus.OK)
    async setRoomRole(
        @Param('roomId') roomId: string,
        @Body() dto: SetRoomRoleDto,
        @CurrentUser() currentUser: any,
    ) {
        return await this.roomRoleService.setRoomRole(
            roomId,
            dto.userId,
            dto.role,
            currentUser.userId,
        );
    }

    /**
     * Ban a user from the room
     */
    @Post('ban')
    @HttpCode(HttpStatus.OK)
    async banUser(
        @Param('roomId') roomId: string,
        @Body() dto: BanUserDto,
        @CurrentUser() currentUser: any,
    ) {
        const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
        return await this.roomRoleService.banUser(
            roomId,
            dto.userId,
            dto.reason,
            currentUser.userId,
            expiresAt,
        );
    }

    /**
     * Unban a user from the room
     */
    @Delete('ban/:userId')
    @HttpCode(HttpStatus.OK)
    async unbanUser(
        @Param('roomId') roomId: string,
        @Param('userId') userId: string,
        @CurrentUser() currentUser: any,
    ) {
        await this.roomRoleService.unbanUser(roomId, userId, currentUser.userId);
        return { message: 'User unbanned successfully' };
    }

    /**
     * Check if user is banned
     */
    @Get('ban/:userId')
    async checkBanStatus(
        @Param('roomId') roomId: string,
        @Param('userId') userId: string,
    ) {
        const isBanned = await this.roomRoleService.isUserBanned(roomId, userId);
        return { isBanned };
    }

    /**
     * Add user to whitelist (invite-only rooms)
     */
    @Post('whitelist')
    @HttpCode(HttpStatus.CREATED)
    async addToWhitelist(
        @Param('roomId') roomId: string,
        @Body() dto: WhitelistUserDto,
        @CurrentUser() currentUser: any,
    ) {
        return await this.roomRoleService.addToWhitelist(
            roomId,
            dto.userId,
            currentUser.userId,
            dto.notes,
        );
    }

    /**
     * Remove user from whitelist
     */
    @Delete('whitelist/:userId')
    @HttpCode(HttpStatus.OK)
    async removeFromWhitelist(
        @Param('roomId') roomId: string,
        @Param('userId') userId: string,
        @CurrentUser() currentUser: any,
    ) {
        await this.roomRoleService.removeFromWhitelist(
            roomId,
            userId,
            currentUser.userId,
        );
        return { message: 'User removed from whitelist' };
    }

    /**
     * Check if user is whitelisted
     */
    @Get('whitelist/:userId')
    async checkWhitelistStatus(
        @Param('roomId') roomId: string,
        @Param('userId') userId: string,
    ) {
        const isWhitelisted = await this.roomRoleService.isUserWhitelisted(
            roomId,
            userId,
        );
        return { isWhitelisted };
    }

    /**
     * Pause room (emergency control)
     */
    @Post('pause')
    @HttpCode(HttpStatus.OK)
    async pauseRoom(
        @Param('roomId') roomId: string,
        @Body() dto: EmergencyPauseDto,
        @CurrentUser() currentUser: any,
    ) {
        return await this.roomRoleService.pauseRoom(
            roomId,
            currentUser.userId,
            dto.reason,
            dto.description,
        );
    }

    /**
     * Resume room (emergency control)
     */
    @Post('resume')
    @HttpCode(HttpStatus.OK)
    async resumeRoom(
        @Param('roomId') roomId: string,
        @CurrentUser() currentUser: any,
    ) {
        return await this.roomRoleService.resumeRoom(roomId, currentUser.userId);
    }

    /**
     * Check if room is paused
     */
    @Get('pause-status')
    async checkPauseStatus(@Param('roomId') roomId: string) {
        const isPaused = await this.roomRoleService.isRoomPaused(roomId);
        return { isPaused };
    }

    /**
     * Verify room access for user
     */
    @Get('access/:userId')
    async verifyRoomAccess(
        @Param('roomId') roomId: string,
        @Param('userId') userId: string,
    ) {
        return await this.roomRoleService.verifyRoomAccess(roomId, userId);
    }

    /**
     * Get user's role in room
     */
    @Get('user-role/:userId')
    async getUserRoomRole(
        @Param('roomId') roomId: string,
        @Param('userId') userId: string,
    ) {
        const role = await this.roomRoleService.getUserRoomRole(roomId, userId);
        return { role };
    }
}
