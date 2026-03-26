import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  Logger,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { plainToInstance } from 'class-transformer';
import { TranslationService } from '../i18n/services/translation.service';
import { UserSettingsService } from '../user-settings/user-settings.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly translationService: TranslationService,
    private readonly userSettingsService: UserSettingsService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { walletAddress, username, email } = createUserDto;
    const preferredLocale = this.normalizePreferredLocale(createUserDto.preferredLocale) ?? null;

    // Check wallet address uniqueness
    const existingWallet = await this.usersRepository.findByWalletAddress(walletAddress);
    if (existingWallet) {
      throw new ConflictException(
        this.translationService.translate('errors.users.walletAlreadyRegistered'),
      );
    }

    // Check username uniqueness if provided
    if (username) {
      const existingUsername = await this.usersRepository.findByUsername(username);
      if (existingUsername) {
        throw new ConflictException(this.translationService.translate('errors.users.usernameTaken'));
      }
    }

    // Check email uniqueness if provided
    if (email) {
      const existingEmail = await this.usersRepository.findByEmail(email);
      if (existingEmail) {
        throw new ConflictException(
          this.translationService.translate('errors.users.emailRegistered'),
        );
      }
    }

    const user = this.usersRepository.create({
      ...createUserDto,
      walletAddress: walletAddress.toLowerCase(),
      email: email?.toLowerCase(),
      preferredLocale,
    });

    const savedUser = await this.usersRepository.save(user);
    await this.userSettingsService.ensureSettingsForUser(savedUser.id);
    return this.toResponseDto(savedUser);
  }

  async findById(id: string, viewerId?: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(
        this.translationService.translate('errors.users.notFoundById', {
          args: { id },
        }),
      );
    }

    const dto = this.toResponseDto(user);
    return this.applyPrivacy(dto, viewerId);
  }

  async findByUsername(username: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findByUsername(username);

    if (!user) {
      throw new NotFoundException(
        this.translationService.translate('errors.users.notFoundByUsername', {
          args: { username },
        }),
      );
    }

    return this.applyPrivacy(this.toResponseDto(user));
  }

  async findByWalletAddress(walletAddress: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findByWalletAddress(walletAddress);

    if (!user) {
      throw new NotFoundException(
        this.translationService.translate('errors.users.notFoundByWallet', {
          args: { walletAddress },
        }),
      );
    }

    return this.applyPrivacy(this.toResponseDto(user));
  }

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(
        this.translationService.translate('errors.users.notFoundById', {
          args: { id },
        }),
      );
    }

    // Validate username uniqueness if being updated
    if (updateProfileDto.username && updateProfileDto.username !== user.username) {
      const isAvailable = await this.usersRepository.isUsernameAvailable(
        updateProfileDto.username,
        id,
      );
      if (!isAvailable) {
        throw new ConflictException(this.translationService.translate('errors.users.usernameTaken'));
      }
    }

    // Validate email uniqueness if being updated
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const isAvailable = await this.usersRepository.isEmailAvailable(updateProfileDto.email, id);
      if (!isAvailable) {
        throw new ConflictException(
          this.translationService.translate('errors.users.emailRegistered'),
        );
      }
    }

    const preferredLocale = this.normalizePreferredLocale(updateProfileDto.preferredLocale, true);

    // Update user fields
    Object.assign(user, {
      ...updateProfileDto,
      email: updateProfileDto.email?.toLowerCase(),
      ...(preferredLocale !== undefined ? { preferredLocale } : {}),
    });

    const updatedUser = await this.usersRepository.save(user);
    return this.toResponseDto(updatedUser);
  }

  async deactivate(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(
        this.translationService.translate('errors.users.notFoundById', {
          args: { id },
        }),
      );
    }

    if (!user.isActive) {
      throw new BadRequestException(
        this.translationService.translate('errors.users.alreadyDeactivated'),
      );
    }

    user.isActive = false;
    await this.usersRepository.save(user);
  }

  async paginate(pagination: PaginationDto): Promise<PaginatedResponse<UserResponseDto>> {
    const { page = 1, limit = 10 } = pagination;

    const [users, total] = await this.usersRepository.findActiveUsers(pagination);

    return {
      data: await Promise.all(users.map(async (user) => this.applyPrivacy(this.toResponseDto(user)))),
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

  private normalizePreferredLocale(
    preferredLocale?: string | null,
    preserveUndefined = false,
  ): string | null | undefined {
    if (preferredLocale === undefined) {
      return preserveUndefined ? undefined : null;
    }

    if (preferredLocale === null) {
      return null;
    }

    const trimmedLocale = preferredLocale.trim();
    if (!trimmedLocale) {
      return null;
    }

    const normalizedLocale = this.translationService.normalizeSupportedLocale(trimmedLocale);
    if (!normalizedLocale) {
      throw new BadRequestException(
        this.translationService.translate('errors.users.invalidPreferredLocale'),
      );
    }

    return normalizedLocale;
  private async applyPrivacy(user: UserResponseDto, viewerId?: string): Promise<UserResponseDto> {
    if (viewerId && viewerId === user.id) {
      return user;
    }

    const privacy = await this.userSettingsService.getPrivacySettings(user.id);
    if (!privacy.onlineStatusVisible) {
      user.isActive = false;
    }
    return user;
  }
}
