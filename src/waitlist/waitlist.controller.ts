import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

@ApiTags('Waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  // POST /waitlist
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join the waitlist' })
  join(@Body() dto: JoinWaitlistDto, @Ip() ip: string) {
    return this.waitlistService.joinWaitlist(dto.email, dto.referralCode, ip);
  }

  // GET /waitlist/position?email=user@example.com
  @Get('position')
  @ApiOperation({ summary: 'Get your waitlist position' })
  getPosition(@Query('email') email: string) {
    return this.waitlistService.getPosition(email);
  }

  // GET /waitlist/leaderboard
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get top 100 leaderboard' })
  getLeaderboard() {
    return this.waitlistService.getLeaderboard();
  }

  // POST /waitlist/convert
  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convert a waitlist entry to a full user' })
  convert(@Body('email') email: string) {
    return this.waitlistService.convertToUser(email);
  }

  // POST /waitlist/social-share
  @Post('social-share')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Award 50 points for a social share' })
  socialShare(@Body('email') email: string) {
    return this.waitlistService.awardSocialShare(email);
  }
}