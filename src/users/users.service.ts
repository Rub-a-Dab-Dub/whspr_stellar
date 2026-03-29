import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { plainToInstance } from 'class-transformer';
import { ModerationQueueService } from '../ai-moderation/queue/moderation.queue';
import { TranslationService } from '../i18n/services/translation.service';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { OnboardingService } from '../onboarding/onboarding.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly moderationQueueService: ModerationQueueService,
    private readonly translationService: TranslationService,
    private readonly userSettingsService: UserSettingsService,
    private readonly moderationQueueService: ModerationQueueService,
    @Optional() private readonly onboardingService?: OnboardingService,
    @Optional() private readonly platformInviteService?: PlatformInviteService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { walletAddress, username, email } = createUserDto;
    const preferredLocale = this.normalizePreferredLocale(createUserDto.preferredLocale) ?? null;

    const existingWallet = await this.usersRepository.findByWalletAddress(walletAddress);
    if (existingWallet) {
      throw new ConflictException(
        this.translationService.translate('errors.users.walletAlreadyRegistered'),
      );
    }

    if (username) {
      const existingUsername = await this.usersRepository.findByUsername(username);
      if (existingUsername) {
        throw new ConflictException(this.translationService.translate('errors.users.usernameTaken'));
      }
    }

    if (email) {
      const existingEmail = await this.usersRepository.findByEmail(email);
      if (existingEmail) {
        throw new ConflictException(
          this.translationService.translate('errors.users.emailRegistered'),
        );
      }
    }

    const { inviteCode: _omitInvite, ...userFields } = createUserDto;
    const user = this.usersRepository.create({
      ...userFields,
      walletAddress: walletAddress.toLowerCase(),
      email: email?.toLowerCase(),
      preferredLocale,
    });

    const savedUser = await this.usersRepository.save(user);
    await this.enqueueModeration(savedUser);
    await this.userSettingsService.ensureSettingsForUser(savedUser.id);

    if (this.platformInviteService && createUserDto.inviteCode?.trim()) {
      const inviteOn = await this.platformInviteService.isInviteModeEnabled();
      if (inviteOn) {
        await this.platformInviteService.redeemAfterRegistration(
          createUserDto.inviteCode.trim(),
          savedUser.id,
        );
      }
    }

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

    if (updateProfileDto.username && updateProfileDto.username !== user.username) {
      const isAvailable = await this.usersRepository.isUsernameAvailable(
        updateProfileDto.username,
        id,
      );
      if (!isAvailable) {
        throw new ConflictException(this.translationService.translate('errors.users.usernameTaken'));
      }
    }

    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const isAvailable = await this.usersRepository.isEmailAvailable(updateProfileDto.email, id);
      if (!isAvailable) {
        throw new ConflictException(
          this.translationService.translate('errors.users.emailRegistered'),
        );
      }
    }

    const preferredLocale = this.normalizePreferredLocale(updateProfileDto.preferredLocale, true);

    Object.assign(user, {
      ...updateProfileDto,
      email: updateProfileDto.email?.toLowerCase(),
      ...(preferredLocale !== undefined ? { preferredLocale } : {}),
    });

    const updatedUser = await this.usersRepository.save(user);
    await this.enqueueModeration(updatedUser);
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
    const dto = plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });

    if (this.onboardingService) {
      this.onboardingService
        .getProgress(user.id)
        .then((progress) => {
          dto.onboardingProgress = {
            currentStep: progress.currentStep,
            completedSteps: progress.completedSteps,
            skippedSteps: progress.skippedSteps,
            isCompleted: progress.isCompleted,
            completionPercentage: progress.completionPercentage,
            nextStep: progress.nextStep,
          };
        })
        .catch((error) => {
          console.warn('Failed to fetch onboarding progress:', error);
        });
    }

    return dto;
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
  }

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
