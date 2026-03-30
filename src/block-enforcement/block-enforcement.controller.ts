import { Controller, Get, Request, Post, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BlockEnforcementService } from './block-enforcement.service';

@ApiTags('privacy')
@Controller('privacy')
@ApiBearerAuth()
export class BlockEnforcementController {
  constructor(private readonly blockEnforcementService: BlockEnforcementService) {}

  @Get('blocked')
  @ApiOperation({ summary: 'List users blocked by the current user' })
  @ApiResponse({ status: 200, description: 'Array of blocked user IDs', type: [String] })
  async getBlocked(@Request() req: any): Promise<string[]> {
    return this.blockEnforcementService.getBlockedUsers(req.user.id);
  }

  @Get('blocked-by-count')
  @ApiOperation({ summary: 'Get number of users who have blocked the current user' })
  @ApiResponse({ status: 200, description: 'Number of users who blocked current user' })
  async getBlockedByCount(@Request() req: any): Promise<{ blockedByCount: number }> {
    const count = await this.blockEnforcementService.getBlockedByCount(req.user.id);
    return { blockedByCount: count };
  }

  @Post('block/:targetId')
  @ApiOperation({ summary: 'Block a user' })
  @ApiResponse({ status: 201, description: 'User blocked' })
  async blockUser(@Request() req: any, @Param('targetId') targetId: string): Promise<{ success: true }> {
    await this.blockEnforcementService.blockUser(req.user.id, targetId);
    return { success: true };
  }

  @Delete('block/:targetId')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiResponse({ status: 200, description: 'User unblocked' })
  async unblockUser(@Request() req: any, @Param('targetId') targetId: string): Promise<{ success: true }> {
    await this.blockEnforcementService.unblockUser(req.user.id, targetId);
    return { success: true };
  }
}
