import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomMember, MemberRole } from '../entities/room-member.entity';
import { RoomBan } from '../entities/room-ban.entity';
import { RoomWhitelist } from '../entities/room-whitelist.entity';
import { RoomEmergencyPause, EmergencyPauseReason } from '../entities/room-emergency-pause.entity';
import { Room } from '../entities/room.entity';
import { User } from '../../user/entities/user.entity';
import { RoomRole } from '../enums/room-role.enum';
import { MemberPermission, ROLE_PERMISSIONS } from '../constants/room-member.constants';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class RoomRoleService {
    constructor(
        @InjectRepository(RoomMember)
        private roomMemberRepository: Repository<RoomMember>,
        @InjectRepository(RoomBan)
        private roomBanRepository: Repository<RoomBan>,
        @InjectRepository(RoomWhitelist)
        private roomWhitelistRepository: Repository<RoomWhitelist>,
        @InjectRepository(RoomEmergencyPause)
        private emergencyPauseRepository: Repository<RoomEmergencyPause>,
        @InjectRepository(Room)
        private roomRepository: Repository<Room>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private cacheService: CacheService,
    ) { }

    /**
     * Set a user's role in a room
     */
    async setRoomRole(
        roomId: string,
        userId: string,
        newRole: MemberRole,
        initiatorId: string,
    ): Promise<RoomMember> {
        // Verify initiator has permission
        await this.verifyInitiatorPermission(
            roomId,
            initiatorId,
            MemberPermission.MANAGE_ROLES,
        );

        // Get the member to update
        const member = await this.roomMemberRepository.findOne({
            where: { roomId, userId },
        });

        if (!member) {
            throw new NotFoundException('User is not a member of this room');
        }

        // Prevent changing owner role
        const room = await this.roomRepository.findOne({ where: { id: roomId } });
        if (room.ownerId === userId && newRole !== MemberRole.OWNER) {
            throw new ForbiddenException('Cannot change owner role');
        }

        // Prevent non-admin from changing admin roles
        const initiatorMember = await this.roomMemberRepository.findOne({
            where: { roomId, userId: initiatorId },
        });

        if (
            ![MemberRole.ADMIN, MemberRole.OWNER].includes(initiatorMember.role) &&
            member.role === MemberRole.ADMIN
        ) {
            throw new ForbiddenException(
                'Only admins can change other admin roles',
            );
        }

        member.role = newRole;
        member.permissions = ROLE_PERMISSIONS[newRole];

        const updated = await this.roomMemberRepository.save(member);

        // Invalidate cache
        await this.invalidateMemberCache(roomId, userId);

        return updated;
    }

    /**
     * Ban a user from a room
     */
    async banUser(
        roomId: string,
        userId: string,
        reason: string,
        initiatorId: string,
        expiresAt?: Date,
    ): Promise<RoomBan> {
        // Verify initiator has permission
        await this.verifyInitiatorPermission(
            roomId,
            initiatorId,
            MemberPermission.KICK_MEMBERS,
        );

        // Check if user is already banned
        const existingBan = await this.roomBanRepository.findOne({
            where: { roomId, userId },
        });

        if (existingBan && !existingBan.isExpired) {
            throw new BadRequestException('User is already banned from this room');
        }

        // Remove user from room if they're a member
        await this.roomMemberRepository.delete({ roomId, userId });

        // Create ban record
        const ban = this.roomBanRepository.create({
            roomId,
            userId,
            bannedBy: initiatorId,
            reason,
            expiresAt,
        });

        const savedBan = await this.roomBanRepository.save(ban);

        // Invalidate cache
        await this.invalidateMemberCache(roomId, userId);

        return savedBan;
    }

    /**
     * Unban a user from a room
     */
    async unbanUser(
        roomId: string,
        userId: string,
        initiatorId: string,
    ): Promise<void> {
        // Verify initiator has permission
        await this.verifyInitiatorPermission(
            roomId,
            initiatorId,
            MemberPermission.KICK_MEMBERS,
        );

        const ban = await this.roomBanRepository.findOne({
            where: { roomId, userId },
        });

        if (!ban) {
            throw new NotFoundException('User is not banned from this room');
        }

        await this.roomBanRepository.remove(ban);

        // Invalidate cache
        await this.invalidateMemberCache(roomId, userId);
    }

    /**
     * Check if a user is banned from a room
     */
    async isUserBanned(roomId: string, userId: string): Promise<boolean> {
        const cacheKey = `room:ban:${roomId}:${userId}`;
        const cached = await this.cacheService.get(cacheKey);

        if (cached !== null && cached !== undefined) {
            return cached === 'true';
        }

        const ban = await this.roomBanRepository.findOne({
            where: { roomId, userId },
        });

        const isBanned = !!(ban && !ban.isExpired);

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, isBanned ? 'true' : 'false', 300);

        return isBanned;
    }

    /**
     * Add user to room whitelist (invite-only rooms)
     */
    async addToWhitelist(
        roomId: string,
        userId: string,
        initiatorId: string,
        notes?: string,
    ): Promise<RoomWhitelist> {
        // Verify initiator has permission
        await this.verifyInitiatorPermission(
            roomId,
            initiatorId,
            MemberPermission.MANAGE_INVITATIONS,
        );

        // Check if already whitelisted
        const existing = await this.roomWhitelistRepository.findOne({
            where: { roomId, userId },
        });

        if (existing) {
            throw new BadRequestException('User is already whitelisted');
        }

        const whitelist = this.roomWhitelistRepository.create({
            roomId,
            userId,
            addedBy: initiatorId,
            notes,
        });

        const saved = await this.roomWhitelistRepository.save(whitelist);

        // Invalidate cache
        await this.invalidateWhitelistCache(roomId, userId);

        return saved;
    }

    /**
     * Remove user from room whitelist
     */
    async removeFromWhitelist(
        roomId: string,
        userId: string,
        initiatorId: string,
    ): Promise<void> {
        // Verify initiator has permission
        await this.verifyInitiatorPermission(
            roomId,
            initiatorId,
            MemberPermission.MANAGE_INVITATIONS,
        );

        const whitelist = await this.roomWhitelistRepository.findOne({
            where: { roomId, userId },
        });

        if (!whitelist) {
            throw new NotFoundException('User is not whitelisted');
        }

        await this.roomWhitelistRepository.remove(whitelist);

        // Invalidate cache
        await this.invalidateWhitelistCache(roomId, userId);
    }

    /**
     * Check if user is whitelisted for a room
     */
    async isUserWhitelisted(roomId: string, userId: string): Promise<boolean> {
        const cacheKey = `room:whitelist:${roomId}:${userId}`;
        const cached = await this.cacheService.get(cacheKey);

        if (cached !== null) {
            return cached === 'true';
        }

        const whitelist = await this.roomWhitelistRepository.findOne({
            where: { roomId, userId },
        });

        const isWhitelisted = !!whitelist;

        // Cache for 5 minutes
        await this.cacheService.set(
            cacheKey,
            isWhitelisted ? 'true' : 'false',
            300,
        );

        return isWhitelisted;
    }

    /**
     * Pause room (emergency control)
     */
    async pauseRoom(
        roomId: string,
        initiatorId: string,
        reason: EmergencyPauseReason,
        description?: string,
    ): Promise<RoomEmergencyPause> {
        // Verify initiator is room admin or owner
        await this.verifyInitiatorPermission(
            roomId,
            initiatorId,
            MemberPermission.CHANGE_ROOM_SETTINGS,
        );

        // Check if already paused
        const existing = await this.emergencyPauseRepository.findOne({
            where: { roomId, isPaused: true },
        });

        if (existing) {
            throw new BadRequestException('Room is already paused');
        }

        const pause = this.emergencyPauseRepository.create({
            roomId,
            pausedBy: initiatorId,
            reason,
            description,
            isPaused: true,
        });

        const saved = await this.emergencyPauseRepository.save(pause);

        // Invalidate cache
        await this.invalidateRoomCache(roomId);

        return saved;
    }

    /**
     * Resume room (emergency control)
     */
    async resumeRoom(
        roomId: string,
        initiatorId: string,
    ): Promise<RoomEmergencyPause> {
        // Verify initiator is room admin or owner
        await this.verifyInitiatorPermission(
            roomId,
            initiatorId,
            MemberPermission.CHANGE_ROOM_SETTINGS,
        );

        const pause = await this.emergencyPauseRepository.findOne({
            where: { roomId, isPaused: true },
        });

        if (!pause) {
            throw new NotFoundException('Room is not paused');
        }

        pause.isPaused = false;
        pause.resumedAt = new Date();
        pause.resumedBy = initiatorId;

        const updated = await this.emergencyPauseRepository.save(pause);

        // Invalidate cache
        await this.invalidateRoomCache(roomId);

        return updated;
    }

    /**
     * Check if room is paused
     */
    async isRoomPaused(roomId: string): Promise<boolean> {
        const cacheKey = `room:paused:${roomId}`;
        const cached = await this.cacheService.get(cacheKey);

        if (cached !== null) {
            return cached === 'true';
        }

        const pause = await this.emergencyPauseRepository.findOne({
            where: { roomId, isPaused: true },
        });

        const isPaused = !!pause;

        // Cache for 1 minute
        await this.cacheService.set(cacheKey, isPaused ? 'true' : 'false', 60);

        return isPaused;
    }

    /**
     * Verify user can access room (not banned, not paused, whitelisted if needed)
     */
    async verifyRoomAccess(
        roomId: string,
        userId: string,
    ): Promise<{ canAccess: boolean; reason?: string }> {
        // Check if user is banned
        const isBanned = await this.isUserBanned(roomId, userId);
        if (isBanned) {
            return { canAccess: false, reason: 'User is banned from this room' };
        }

        // Check if room is paused
        const isPaused = await this.isRoomPaused(roomId);
        if (isPaused) {
            return { canAccess: false, reason: 'Room is currently paused' };
        }

        // Check whitelist if room is invite-only
        const room = await this.roomRepository.findOne({ where: { id: roomId } });
        if (room.isPrivate) {
            const isWhitelisted = await this.isUserWhitelisted(roomId, userId);
            if (!isWhitelisted) {
                return {
                    canAccess: false,
                    reason: 'User is not whitelisted for this room',
                };
            }
        }

        return { canAccess: true };
    }

    /**
     * Get user's role in a room
     */
    async getUserRoomRole(
        roomId: string,
        userId: string,
    ): Promise<MemberRole | null> {
        const member = await this.roomMemberRepository.findOne({
            where: { roomId, userId },
        });

        return member?.role || null;
    }

    /**
     * Check if user has permission in room
     */
    async hasRoomPermission(
        roomId: string,
        userId: string,
        permission: MemberPermission,
    ): Promise<boolean> {
        const member = await this.roomMemberRepository.findOne({
            where: { roomId, userId },
        });

        if (!member) {
            return false;
        }

        const permissions = member.permissions || ROLE_PERMISSIONS[member.role];
        return permissions.includes(permission);
    }

    /**
     * Verify initiator has required permission
     */
    private async verifyInitiatorPermission(
        roomId: string,
        initiatorId: string,
        requiredPermission: MemberPermission,
    ): Promise<void> {
        const hasPermission = await this.hasRoomPermission(
            roomId,
            initiatorId,
            requiredPermission,
        );

        if (!hasPermission) {
            throw new ForbiddenException(
                `You do not have permission to perform this action`,
            );
        }
    }

    /**
     * Invalidate member cache
     */
    private async invalidateMemberCache(
        roomId: string,
        userId: string,
    ): Promise<void> {
        const keys = [
            `room:ban:${roomId}:${userId}`,
            `room:whitelist:${roomId}:${userId}`,
            `room:member:${roomId}:${userId}`,
        ];

        for (const key of keys) {
            await this.cacheService.del(key);
        }
    }

    /**
     * Invalidate whitelist cache
     */
    private async invalidateWhitelistCache(
        roomId: string,
        userId: string,
    ): Promise<void> {
        await this.cacheService.del(`room:whitelist:${roomId}:${userId}`);
    }

    /**
     * Invalidate room cache
     */
    private async invalidateRoomCache(roomId: string): Promise<void> {
        await this.cacheService.del(`room:paused:${roomId}`);
    }
}
