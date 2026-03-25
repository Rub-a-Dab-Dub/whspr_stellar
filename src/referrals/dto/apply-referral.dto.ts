import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyReferralDto {
  @ApiProperty({
    example: 'A1B2C3D4',
    description: 'The unique referral code of the referrer',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 8)
  code!: string;
}
