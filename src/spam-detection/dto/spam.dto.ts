import { IsNotEmpty, IsString, IsUUID, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class ScoreMessageDto {
  @IsNotEmpty()
  @IsUUID()
  messageId: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsUUID()
  senderId: string;

  @IsOptional()
  @IsUUID('all', { each: true })
  recipientIds?: string[];

  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class ScoreUserDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  reason?: string; // "manual_review", "threshold_breach", etc
}

export class FlagContentDto {
  @IsNotEmpty()
  @IsUUID()
  contentId: string;

  @IsNotEmpty()
  @IsString()
  contentType: string; // "message", "profile", etc

  @IsNotEmpty()
  @IsUUID()
  reportedBy: string;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}

export class SpamScoreResponseDto {
  id: string;
  userId: string;
  score: number;
  factors: any;
  action: string;
  triggeredAt: Date;
  reviewedAt: Date;
  reviewedBy: string;
  isFalsePositive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AdminReviewDto {
  @IsNotEmpty()
  @IsString()
  decision: 'approve' | 'reject_false_positive' | 'adjust';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  adjustedScore?: number;
}

export class SpamStatsResponseDto {
  totalUsers: number;
  highRiskUsers: number;
  warnedUsers: number;
  throttledUsers: number;
  suspendedUsers: number;
  averageScore: number;
  actionBreakdown: {
    none: number;
    warn: number;
    throttle: number;
    suspend: number;
  };
  topFactors: {
    name: string;
    occurrences: number;
  }[];
  trendingUsers: {
    userId: string;
    username: string;
    score: number;
    action: string;
  }[];
}

export class SpamQueueResponseDto {
  id: string;
  userId: string;
  username: string;
  score: number;
  action: string;
  factors: any;
  triggeredAt: Date;
  daysSinceFlag: number;
}
