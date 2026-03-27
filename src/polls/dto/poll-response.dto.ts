import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PollVoterDto {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  username!: string | null;

  @ApiPropertyOptional()
  displayName!: string | null;
}

export class PollOptionResultDto {
  @ApiProperty()
  index!: number;

  @ApiProperty()
  text!: string;

  @ApiProperty()
  voteCount!: number;

  @ApiPropertyOptional({ type: [PollVoterDto] })
  voters?: PollVoterDto[];
}

export class PollUserVoteDto {
  @ApiProperty({ type: [Number] })
  optionIndexes!: number[];

  @ApiProperty()
  votedAt!: Date;
}

export class PollResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty()
  question!: string;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty()
  allowMultiple!: boolean;

  @ApiProperty()
  isAnonymous!: boolean;

  @ApiPropertyOptional()
  expiresAt!: Date | null;

  @ApiProperty()
  isClosed!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  totalVoters!: number;

  @ApiProperty({ type: [PollOptionResultDto] })
  results!: PollOptionResultDto[];

  @ApiPropertyOptional({ type: PollUserVoteDto })
  currentUserVote!: PollUserVoteDto | null;
}

export class PollRealtimePayloadDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty()
  question!: string;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty()
  allowMultiple!: boolean;

  @ApiProperty()
  isAnonymous!: boolean;

  @ApiPropertyOptional()
  expiresAt!: Date | null;

  @ApiProperty()
  isClosed!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  totalVoters!: number;

  @ApiProperty({ type: [PollOptionResultDto] })
  results!: PollOptionResultDto[];
}
