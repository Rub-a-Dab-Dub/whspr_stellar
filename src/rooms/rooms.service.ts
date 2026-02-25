import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Room, RoomType } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { RoomBlockchainService } from './services/room-blockchain.service';
import { PaymentInstructionsDto } from './dto/join-room.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(RoomMember)
    private roomMemberRepository: Repository<RoomMember>,
    private roomBlockchainService: RoomBlockchainService,
    private configService: ConfigService,
  ) {}

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