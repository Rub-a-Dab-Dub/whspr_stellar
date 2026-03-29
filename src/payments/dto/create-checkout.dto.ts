import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator';
import { UserTier } from '../../users/entities/user.entity';

export class CreateCheckoutDto {
  @IsEnum(UserTier)
  @IsNotEmpty()
  tier!: UserTier;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNumber()
  @IsPositive()
  @Min(100)
  amount!: number; // in kobo, e.g. 50000 for ₦500
}

