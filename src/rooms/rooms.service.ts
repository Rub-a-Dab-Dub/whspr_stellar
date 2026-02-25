import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Room, RoomType } from './entities/room.entity';
import { RoomMember, RoomMemberRole } from './entities/room-member.entity';
import { RoomBlockchainService } from './services/room-blockchain.service';
import { PaymentInstructionsDto } from './dto/join-room.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { GetRoomsDto } from './dto/get-rooms.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(RoomMember)
    private roomMemberRepository: Repository<RoomMember>,
    private roomBlockchainService: RoomBlockchainService,
    private configService: ConfigService,
    private userService: UserService,
  ) {}

  async createRoom(
    createRoomDto: CreateRoomDto,
    creatorId: string,
    creatorWalletAddress?: string,
  ): Promise<Room> {
    // Validate room type specific requirements
    if (
      createRoomDto.type === RoomType.TOKEN_GATED &&
      (!createRoomDto.entryFee || !createRoomDto.tokenAddress)
    ) {
      throw new BadRequestException(
        'Token-gated rooms require entryFee and tokenAddress',
      );
    }
    if (createRoomDto.type === RoomType.TIMED && !createRoomDto.expiresAt) {
      throw new BadRequestException('Timed rooms require expiresAt');
    }

    const room = this.roomRepository.create({
      ...createRoomDto,
      creatorId,
      creatorWalletAddress,
      maxMembers: createRoomDto.maxMembers || 100,
      expiresAt: createRoomDto.expiresAt
        ? new Date(createRoomDto.expiresAt)
        : null,
    });

    const savedRoom = await this.roomRepository.save(room);

    // Award XP to creator
    await this.userService.addXP(creatorId, 50);

    return savedRoom;
  }

  async getRooms(
    getRoomsDto: GetRoomsDto,
  ): Promise<{ rooms: Room[]; total: number }> {
    const { page = 1, limit = 10 } = getRoomsDto;
    const skip = (page - 1) * limit;

    const [rooms, total] = await this.roomRepository.findAndCount({
      where: {
        type: RoomType.PUBLIC,
        isActive: true,
        expiresAt: null, // Only non-expired rooms or rooms without expiry
      },
      order: { createdAt: 'DESC' }, // Sort by activity (using createdAt as proxy)
      skip,
      take: limit,
    });

    return { rooms, total };
  }

  async getRoomById(id: string): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  async updateRoom(
    id: string,
    updateRoomDto: UpdateRoomDto,
    userId: string,
  ): Promise<Room> {
    const room = await this.getRoomById(id);

    if (room.creatorId !== userId) {
      throw new ForbiddenException('Only room creator can update the room');
    }

    Object.assign(room, {
      ...updateRoomDto,
      expiresAt: updateRoomDto.expiresAt
        ? new Date(updateRoomDto.expiresAt)
        : room.expiresAt,
    });

    return this.roomRepository.save(room);
  }

  async deleteRoom(
    id: string,
    userId: string,
    isAdmin: boolean = false,
  ): Promise<void> {
    const room = await this.getRoomById(id);

    if (!isAdmin && room.creatorId !== userId) {
      throw new ForbiddenException(
        'Only room creator or admin can delete the room',
      );
    }

    room.isActive = false;
    await this.roomRepository.save(room);
  }

  async initiateJoin(
    roomId: string,
    userId: string,
    userWalletAddress: string,
  ): Promise<PaymentInstructionsDto | { success: boolean }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Check if user is already a member
    const existingMember = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (existingMember) {
      if (existingMember.isBanned) {
        throw new ForbiddenException('User is banned from this room');
      }
      throw new ConflictException('User is already a member of this room');
    }

    if (room.type === RoomType.PUBLIC) {
      // For public rooms, join immediately
      await this.roomMemberRepository.save({
        roomId,
        userId,
        transactionHash: null,
        paidAmount: null,
      });
      return { success: true };
    }

    if (room.type === RoomType.TOKEN_GATED) {
      // Return payment instructions
      return {
        contractAddress:
          this.configService.get('PAYMENT_CONTRACT_ADDRESS') || 'GCEXAMPLE',
        amount: room.entryFee,
        tokenAddress: room.tokenAddress || 'native',
        recipientAddress: room.creatorWalletAddress,
      };
    }

    throw new BadRequestException('Invalid room type');
  }

  async confirmJoin(
    roomId: string,
    userId: string,
    transactionHash: string,
  ): Promise<{ success: boolean; error?: string }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.type !== RoomType.TOKEN_GATED) {
      throw new BadRequestException('Room is not token-gated');
    }

    // Check if transaction hash is already used
    const existingMember = await this.roomMemberRepository.findOne({
      where: { transactionHash },
    });
    if (existingMember) {
      throw new ConflictException('Transaction hash already used');
    }

    // Verify transaction on-chain
    const verification = await this.roomBlockchainService.verifyTransaction(
      transactionHash,
      room.entryFee,
      room.creatorWalletAddress,
    );

    if (!verification.isValid) {
      return { success: false, error: verification.error };
    }

    // Distribute fees
    const treasuryWallet =
      this.configService.get('TREASURY_WALLET_ADDRESS') || 'GTREASURY';
    const feeDistribution = await this.roomBlockchainService.distributeFees(
      room.entryFee,
      room.creatorWalletAddress,
      treasuryWallet,
    );

    if (!feeDistribution.success) {
      return { success: false, error: feeDistribution.error };
    }

    // Create room membership
    await this.roomMemberRepository.save({
      roomId,
      userId,
      transactionHash,
      paidAmount: room.entryFee,
    });

    return { success: true };
  }

  // Member Management Methods

  private async checkModeratorOrCreator(
    roomId: string,
    initiatorId: string,
  ): Promise<Room> {
    const room = await this.getRoomById(roomId);
    if (room.creatorId === initiatorId) return room;

    const initiatorMember = await this.roomMemberRepository.findOne({
      where: { roomId, userId: initiatorId },
    });

    if (!initiatorMember || initiatorMember.role !== RoomMemberRole.MODERATOR) {
      throw new ForbiddenException(
        'Only room creator or moderator can perform this action',
      );
    }

    return room;
  }

  async inviteMember(
    roomId: string,
    inviteDto: InviteMemberDto,
    initiatorId: string,
  ) {
    const room = await this.checkModeratorOrCreator(roomId, initiatorId);

    let userToInvite;
    if (inviteDto.userId) {
      userToInvite = await this.userService.findOne(inviteDto.userId);
    } else if (inviteDto.walletAddress) {
      userToInvite = await this.userService.findOneByWalletAddress(
        inviteDto.walletAddress,
      );
    } else {
      throw new BadRequestException('Must provide userId or walletAddress');
    }

    const existingMember = await this.roomMemberRepository.findOne({
      where: { roomId, userId: userToInvite.id },
    });

    if (existingMember) {
      if (existingMember.isBanned) {
        throw new ForbiddenException('User is banned from this room');
      }
      throw new ConflictException('User is already a member');
    }

    await this.roomMemberRepository.save({
      roomId,
      userId: userToInvite.id,
      transactionHash: null,
      paidAmount: null, // Invited members bypass entry fee
    });

    return { success: true };
  }

  async removeMember(roomId: string, userId: string, initiatorId: string) {
    const room = await this.checkModeratorOrCreator(roomId, initiatorId);

    if (room.creatorId === userId) {
      throw new ForbiddenException('Cannot remove room creator');
    }

    const member = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (!member) throw new NotFoundException('Member not found in room');

    await this.roomMemberRepository.remove(member);
    return { success: true };
  }

  async banMember(roomId: string, userId: string, initiatorId: string) {
    const room = await this.checkModeratorOrCreator(roomId, initiatorId);

    if (room.creatorId === userId) {
      throw new ForbiddenException('Cannot ban room creator');
    }

    let member = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });

    if (!member) {
      // Create a banned entry if they aren't currently a member
      member = this.roomMemberRepository.create({ roomId, userId });
    }

    member.isBanned = true;
    await this.roomMemberRepository.save(member);
    return { success: true };
  }

  async updateMemberRole(
    roomId: string,
    userId: string,
    updateDto: UpdateMemberRoleDto,
    initiatorId: string,
  ) {
    const room = await this.getRoomById(roomId);

    // Only the creator can assign or revoke moderator roles
    if (room.creatorId !== initiatorId) {
      throw new ForbiddenException('Only room creator can update roles');
    }

    if (room.creatorId === userId) {
      throw new ForbiddenException('Cannot change creator role');
    }

    const member = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (!member) throw new NotFoundException('Member not found in room');
    if (member.isBanned)
      throw new ForbiddenException('User is banned from this room');

    member.role = updateDto.role;
    await this.roomMemberRepository.save(member);
    return { success: true };
  }

  async getMembers(roomId: string, getRoomsDto: GetRoomsDto) {
    const { page = 1, limit = 10 } = getRoomsDto;
    const skip = (page - 1) * limit;

    const [members, total] = await this.roomMemberRepository.findAndCount({
      where: { roomId, isBanned: false },
      relations: ['user'],
      skip,
      take: limit,
      order: { joinedAt: 'DESC' },
    });

    const formattedMembers = members.map((m) => {
      const userObj = m.user as any;
      return {
        userId: m.userId,
        roomId: m.roomId,
        role: m.role,
        isBanned: m.isBanned,
        joinedAt: m.joinedAt,
        username: userObj?.username,
        walletAddress: userObj?.walletAddress,
        avatarUrl: userObj?.avatarUrl,
      };
    });

    return { members: formattedMembers, total };
  }
}
