import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;
const SOROBAN_CONTRACT_REGEX = /^C[A-Z2-7]{55}$/;

export interface ResolvedRecipient {
  userId: string | null;
  walletAddress: string;
}

@Injectable()
export class RecipientResolutionService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async resolve(recipient: string, senderId: string): Promise<ResolvedRecipient> {
    const trimmed = recipient.trim();
    if (!trimmed) {
      throw new BadRequestException('Recipient cannot be empty');
    }

    if (trimmed === senderId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    if (UUID_REGEX.test(trimmed)) {
      return this.resolveByUserId(trimmed);
    }

    if (STELLAR_ADDRESS_REGEX.test(trimmed) || SOROBAN_CONTRACT_REGEX.test(trimmed)) {
      return this.resolveByWalletAddress(trimmed);
    }

    return this.resolveByUsername(trimmed);
  }

  private async resolveByUserId(userId: string): Promise<ResolvedRecipient> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'walletAddress', 'isBanned', 'suspendedUntil'],
    });

    if (!user) {
      throw new NotFoundException('Recipient user not found');
    }

    this.validateUserAccount(user);

    if (!user.walletAddress) {
      throw new BadRequestException('Recipient has no wallet address linked');
    }

    return {
      userId: user.id,
      walletAddress: user.walletAddress,
    };
  }

  private async resolveByWalletAddress(walletAddress: string): Promise<ResolvedRecipient> {
    const user = await this.userRepository.findOne({
      where: { walletAddress },
      select: ['id', 'walletAddress', 'isBanned', 'suspendedUntil'],
    });

    if (user) {
      this.validateUserAccount(user);
      return {
        userId: user.id,
        walletAddress: user.walletAddress ?? walletAddress,
      };
    }

    return {
      userId: null,
      walletAddress,
    };
  }

  private async resolveByUsername(username: string): Promise<ResolvedRecipient> {
    const user = await this.userRepository.findOne({
      where: { username },
      select: ['id', 'walletAddress', 'isBanned', 'suspendedUntil'],
    });

    if (!user) {
      throw new NotFoundException('Recipient username not found');
    }

    this.validateUserAccount(user);

    if (!user.walletAddress) {
      throw new BadRequestException('Recipient has no wallet address linked');
    }

    return {
      userId: user.id,
      walletAddress: user.walletAddress,
    };
  }

  private validateUserAccount(user: Partial<User>): void {
    if (user.isBanned) {
      throw new BadRequestException('Recipient account is banned');
    }
    if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
      throw new BadRequestException('Recipient account is suspended');
    }
  }
}
