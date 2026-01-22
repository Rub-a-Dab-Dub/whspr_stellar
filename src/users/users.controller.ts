import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { XpHistoryQueryDto } from './dto/xp-history-query.dto';
import { AddXpDto } from './dto/add-xp.dto';
import { XpService } from './services/xp.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly xpService: XpService,
  ) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('search')
  search(@Query() searchDto: SearchUsersDto) {
    return this.usersService.findAll(searchDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get('username/:username')
  findByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  uploadAvatar(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(id, file);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/xp')
  @HttpCode(HttpStatus.OK)
  addXp(@Param('id') id: string, @Body() addXpDto: AddXpDto) {
    return this.xpService.addXp(id, addXpDto.action, addXpDto.description);
  }

  @Get(':id/xp')
  getUserXpStats(@Param('id') id: string) {
    return this.xpService.getUserXpStats(id);
  }

  @Get(':id/xp/history')
  getUserXpHistory(
    @Param('id') id: string,
    @Query() query: XpHistoryQueryDto,
  ) {
    return this.xpService.getXpHistory(id, query.page, query.limit);
  }

  @Get('leaderboard/top')
  getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.xpService.getLeaderboard(query.page, query.limit);
  }

  @Get('analytics/xp')
  getXpAnalytics() {
    return Promise.all([
      this.xpService.getTotalXp(),
      this.xpService.getAverageXpPerUser(),
      this.xpService.getWeeklyXp(),
      this.xpService.getXpByAction(),
    ]).then(([total, average, weekly, byAction]) => ({
      totalXp: total,
      averageXpPerUser: average,
      weekly,
      byAction,
    }));
  }
}
