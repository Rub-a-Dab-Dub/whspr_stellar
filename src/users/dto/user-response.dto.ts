import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { UserTier } from '../entities/user.entity';

@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @Expose()
  @ApiPropertyOptional({ example: 'john_doe' })
  username!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
  walletAddress!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: 'john@example.com' })
  email!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: 'John Doe' })
  displayName!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: 'Crypto enthusiast and developer' })
  bio!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: 'en' })
  preferredLocale!: string | null;

  @Expose()
  @ApiProperty({ enum: UserTier, example: UserTier.SILVER })
  tier!: UserTier;

  @Expose()
  @ApiProperty({ example: true })
  isActive!: boolean;

  @Expose()
  @ApiProperty({ example: false })
  isVerified!: boolean;

  @Expose()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @Expose()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt!: Date;

  @Expose()
  @ApiPropertyOptional({ 
    description: 'Onboarding progress information',
    type: 'object',
    example: {
      currentStep: 'profile_completed',
      completedSteps: ['wallet_connected', 'profile_completed'],
      skippedSteps: [],
      isCompleted: false,
      completionPercentage: 28,
      nextStep: 'username_set'
    }
  })
  onboardingProgress?: {
    currentStep: string | null;
    completedSteps: string[];
    skippedSteps: string[];
    isCompleted: boolean;
    completionPercentage: number;
    nextStep: string | null;
  };

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
