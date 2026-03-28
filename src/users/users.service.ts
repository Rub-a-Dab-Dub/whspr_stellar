import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { plainToInstance } from 'class-transformer';
import { ModerationQueueService } from '../ai-moderation/queue/moderation.queue';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly moderationQueueService: ModerationQueueService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { walletAddress, username, email } = createUserDto;

    // Check wallet address uniqueness
    const existingWallet = await this.usersRepository.findByWalletAddress(walletAddress);
    if (existingWallet) {
      throw new ConflictException('Wallet address already registered');
    }

    // Check username uniqueness if provided
    if (username) {
      const existingUsername = await this.usersRepository.findByUsername(username);
      if (existingUsername) {
        throw new ConflictException('Username already taken');
      }
    }

    // Check email uniqueness if provided
    if (email) {
      const existingEmail = await this.usersRepository.findByEmail(email);
      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    const user = this.usersRepository.create({
      ...createUserDto,
      walletAddress: walletAddress.toLowerCase(),
      email: email?.toLowerCase(),
    });

    const savedUser = await this.usersRepository.save(user);
    await this.enqueueModeration(savedUser);
    return this.toResponseDto(savedUser);
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.toResponseDto(user);
  }

  async findByUsername(username: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findByUsername(username);

    if (!user) {
      throw new NotFoundException(`User with username ${username} not found`);
    }

    return this.toResponseDto(user);
  }

  async findByWalletAddress(walletAddress: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findByWalletAddress(walletAddress);

    if (!user) {
      throw new NotFoundException(`User with wallet address ${walletAddress} not found`);
    }

    return this.toResponseDto(user);
  }

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Validate username uniqueness if being updated
    if (updateProfileDto.username && updateProfileDto.username !== user.username) {
      const isAvailable = await this.usersRepository.isUsernameAvailable(
        updateProfileDto.username,
        id,
      );
      if (!isAvailable) {
        throw new ConflictException('Username already taken');
      }
    }

    // Validate email uniqueness if being updated
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const isAvailable = await this.usersRepository.isEmailAvailable(updateProfileDto.email, id);
      if (!isAvailable) {
        throw new ConflictException('Email already registered');
      }
    }

    // Update user fields
    Object.assign(user, {
      ...updateProfileDto,
      email: updateProfileDto.email?.toLowerCase(),
    });

    const updatedUser = await this.usersRepository.save(user);
    await this.enqueueModeration(updatedUser);
    return this.toResponseDto(updatedUser);
  }

  async deactivate(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!user.isActive) {
      throw new BadRequestException('User is already deactivated');
    }

    user.isActive = false;
    await this.usersRepository.save(user);
  }

  async paginate(pagination: PaginationDto): Promise<PaginatedResponse<UserResponseDto>> {
    const { page = 1, limit = 10 } = pagination;

    const [users, total] = await this.usersRepository.findActiveUsers(pagination);

    return {
      data: users.map((user) => this.toResponseDto(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private toResponseDto(user: User): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  private async enqueueModeration(user: User): Promise<void> {
    const profileContent = [user.username, user.displayName, user.bio].filter(Boolean).join(' ');

    try {
      if (profileContent) {
        await this.moderationQueueService.enqueueProfileModeration(user.id, profileContent);
      }

      await this.moderationQueueService.enqueueUserModeration(
        user.id,
        [user.walletAddress, user.email].filter(Boolean).join(' '),
      );

      if (user.avatarUrl) {
        await this.moderationQueueService.enqueueImageModeration(user.id, user.avatarUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Failed to enqueue moderation jobs for user ${user.id}: ${message}`);
    }
  }
}
