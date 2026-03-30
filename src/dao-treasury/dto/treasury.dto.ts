import { IsEnum, IsInt, IsNotEmpty, IsPositive, IsString, Min } from 'class-validator';
import { VoteChoice } from '../entities/treasury-vote.entity';

export class DepositDto {
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsString()
  @IsNotEmpty()
  tokenAddress!: string;
}

export class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  recipientAddress!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsInt()
  @Min(1)
  quorumRequired: number = 2;

  /** TTL in seconds; defaults to env PROPOSAL_TTL_SECONDS or 604800 (7 days) */
  @IsInt()
  @IsPositive()
  ttlSeconds?: number;
}

export class CastVoteDto {
  @IsEnum(VoteChoice)
  vote!: VoteChoice;
}
