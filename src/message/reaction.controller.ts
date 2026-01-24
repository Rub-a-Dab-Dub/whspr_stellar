import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReactionService } from './reaction.service';
import {
  CreateReactionDto,
  ReactionResponseDto,
  MessageReactionsAggregateDto,
  ReactionCountDto,
} from './dto/reaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class ReactionController {
  constructor(private readonly reactionService: ReactionService) {}

  /**
   * Add a reaction to a message
   * POST /messages/:messageId/react
   */
  @Post(':messageId/react')
  @HttpCode(HttpStatus.CREATED)
  async addReaction(
    @Param('messageId') messageId: string,
    @Body() createReactionDto: CreateReactionDto,
    @Request() req: any,
  ): Promise<ReactionResponseDto> {
    return this.reactionService.addReaction(
      messageId,
      req.user.id as string,
      createReactionDto.type,
    );
  }

  /**
   * Remove a specific reaction from a message
   * DELETE /messages/:messageId/react/:type
   */
  @Delete(':messageId/react/:type')
  @HttpCode(HttpStatus.OK)
  async removeReaction(
    @Param('messageId') messageId: string,
    @Param('type') type: string,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    await this.reactionService.removeReaction(
      messageId,
      req.user.id as string,
      type,
    );
    return {
      success: true,
      message: 'Reaction removed successfully',
    };
  }

  /**
   * Get all reactions for a message (aggregated)
   * GET /messages/:messageId/reactions
   */
  @Get(':messageId/reactions')
  @HttpCode(HttpStatus.OK)
  async getMessageReactions(
    @Param('messageId') messageId: string,
    @Request() req: any,
  ): Promise<MessageReactionsAggregateDto> {
    return this.reactionService.getMessageReactions(
      messageId,
      req.user?.id as string | undefined,
    );
  }

  /**
   * Get detailed reactions with user information
   * GET /messages/:messageId/reactions/detailed
   */
  @Get(':messageId/reactions/detailed')
  @HttpCode(HttpStatus.OK)
  async getDetailedReactions(@Param('messageId') messageId: string): Promise<{
    messageId: string;
    reactions: Array<{
      id: string;
      type: string;
      userId: string;
      userName: string | undefined;
      createdAt: Date;
    }>;
    count: number;
  }> {
    const reactions =
      await this.reactionService.getMessageReactionsDetailed(messageId);
    return {
      messageId,
      reactions: reactions.map((r) => ({
        id: r.id,
        type: r.type,
        userId: r.userId,
        userName: r.user?.email,
        createdAt: r.createdAt,
      })),
      count: reactions.length,
    };
  }

  /**
   * Get all users who reacted with specific emoji
   * GET /messages/:messageId/reactions/:type/users
   */
  @Get(':messageId/reactions/:type/users')
  @HttpCode(HttpStatus.OK)
  async getReactionUsers(
    @Param('messageId') messageId: string,
    @Param('type') type: string,
  ): Promise<{ type: string; userIds: string[]; count: number }> {
    const userIds = await this.reactionService.getReactionsByType(
      messageId,
      type,
    );
    return {
      type,
      userIds,
      count: userIds.length,
    };
  }

  /**
   * Get current user's reactions on a message
   * GET /messages/:messageId/my-reactions
   */
  @Get(':messageId/my-reactions')
  @HttpCode(HttpStatus.OK)
  async getUserReactions(
    @Param('messageId') messageId: string,
    @Request() req: any,
  ): Promise<{ messageId: string; reactions: string[] }> {
    const reactions = await this.reactionService.getUserReactions(
      messageId,
      req.user.id as string,
    );
    return {
      messageId,
      reactions,
    };
  }

  /**
   * Get popular reactions globally
   * GET /reactions/popular
   */
  @Get('/reactions/popular')
  @HttpCode(HttpStatus.OK)
  async getPopularReactions(
    @Query('limit') limit: number = 10,
  ): Promise<{ reactions: ReactionCountDto[]; limit: number }> {
    const reactions = await this.reactionService.getPopularReactions(
      Math.min(limit, 50),
    );
    return {
      reactions,
      limit,
    };
  }

  /**
   * Get user's reaction analytics
   * GET /reactions/analytics/me
   */
  @Get('/reactions/analytics/me')
  @HttpCode(HttpStatus.OK)
  async getUserAnalytics(@Request() req: any): Promise<any> {
    const analytics = await this.reactionService.getUserReactionAnalytics(
      req.user.id as string,
    );
    return {
      userId: req.user.id,
      ...analytics,
    };
  }

  /**
   * Get reaction count for a message
   * GET /messages/:messageId/reaction-count
   */
  @Get(':messageId/reaction-count')
  @HttpCode(HttpStatus.OK)
  async getReactionCount(
    @Param('messageId') messageId: string,
  ): Promise<{ messageId: string; count: number }> {
    const count = await this.reactionService.getReactionCount(messageId);
    return {
      messageId,
      count,
    };
  }

  /**
   * Check if user has a specific reaction
   * GET /messages/:messageId/check-reaction/:type
   */
  @Get(':messageId/check-reaction/:type')
  @HttpCode(HttpStatus.OK)
  async checkUserReaction(
    @Param('messageId') messageId: string,
    @Param('type') type: string,
    @Request() req: any,
  ): Promise<{ hasReaction: boolean; type: string; messageId: string }> {
    const hasReaction = await this.reactionService.userHasReaction(
      messageId,
      req.user.id as string,
      type,
    );
    return {
      hasReaction,
      type,
      messageId,
    };
  }
}
