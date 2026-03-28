import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { BadgesService } from './badges.service';
import { UpdateDisplayedBadgesDto } from './dto/badge.dto';

@ApiTags('badges')
@ApiBearerAuth()
@Controller('badges')
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all available badges' })
  findAll() {
    return this.badgesService.findAll();
  }

  @Get('users/:userId')
  @Public()
  @ApiOperation({ summary: 'Get badges earned by a specific user' })
  findForUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.badgesService.findForUser(userId);
  }

  @Put('display')
  @ApiOperation({ summary: 'Select up to 3 badges to display on your profile' })
  updateDisplayed(
    @CurrentUser() user: UserResponseDto,
    @Body() dto: UpdateDisplayedBadgesDto,
  ) {
    return this.badgesService.updateDisplayedBadges(user.id, dto.badgeIds);
  }
}
