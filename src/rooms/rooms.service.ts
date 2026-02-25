import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Room, RoomType } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { RoomBlockchainService } from './services/room-blockchain.service';
import { PaymentInstructionsDto } from './dto/join-room.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { GetRoomsDto } from './dto/get-rooms.dto';
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

  async createRoom(createRoomDto: CreateRoomDto, creatorId: string, creatorWalletAddress?: string): Promise<Room> {
    // Validate room type specific requirements
    if (createRoomDto.type === RoomType.TOKEN_GATED && (!createRoomDto.entryFee || !createRoomDto.tokenAddress)) {
      throw new BadRequestException('Token-gated rooms require entryFee and tokenAddress');
    }
    if (createRoomDto.type === RoomType.TIMED && !createRoomDto.expiresAt) {
      throw new BadRequestException('Timed rooms require expiresAt');
    }

    const room = this.roomRepository.create({
      ...createRoomDto,
      creatorId,
      creatorWalletAddress,
      maxMembers: createRoomDto.maxMembers || 100,
      expiresAt: createRoomDto.expiresAt ? new Date(createRoomDto.expiresAt) : null,
    });

    const savedRoom = await this.roomRepository.save(room);
    
    // Award XP to creator
    await this.userService.addXP(creatorId, 50);
    
    return savedRoom;
  }

  async getRooms(getRoomsDto: GetRoomsDto): Promise<{ rooms: Room[]; total: number }> {
    const { page = 1, limit = 10 } = getRoomsDto;
    const skip = (page - 1) * limit;

    const [rooms, total] = await this.roomRepository.findAndCount({
      where: { 
        type: RoomType.PUBLIC, 
        isActive: true,
        expiresAt: null // Only non-expired rooms or rooms without expiry
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

  async updateRoom(id: string, updateRoomDto: UpdateRoomDto, userId: string): Promise<Room> {
    const room = await this.getRoomById(id);
    
    if (room.creatorId !== userId) {
      throw new ForbiddenException('Only room creator can update the room');
    }

    Object.assign(room, {
      ...updateRoomDto,
      expiresAt: updateRoomDto.expiresAt ? new Date(updateRoomDto.expiresAt) : room.expiresAt,
    });

    return this.roomRepository.save(room);
  }

  async deleteRoom(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    const room = await this.getRoomById(id);
    
    if (!isAdmin && room.creatorId !== userId) {
      throw new ForbiddenException('Only room creator or admin can delete the room');
    }

    room.isActive = false;
    await this.roomRepository.save(room);
  }

  async initiateJoin(roomId: string, userId: string, userWalletAddress: string): Promise<PaymentInstructionsDto | { success: boolean }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Check if user is already a member
    const existingMember = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (existingMember) {
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
        contractAddress: this.configService.get('PAYMENT_CONTRACT_ADDRESS') || 'GCEXAMPLE',
        amount: room.entryFee,
        tokenAddress: room.tokenAddress || 'native',
        recipientAddress: room.creatorWalletAddress,
      };
    }

    throw new BadRequestException('Invalid room type');
  }

  async confirmJoin(roomId: string, userId: string, transactionHash: string): Promise<{ success: boolean; error?: string }> {
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
    const treasuryWallet = this.configService.get('TREASURY_WALLET_ADDRESS') || 'GTREASURY';
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
}