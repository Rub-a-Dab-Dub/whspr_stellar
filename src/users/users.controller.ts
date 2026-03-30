import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { BlockGuard } from '../block-enforcement/block.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { LocalizedParseUUIDPipe } from '../i18n/pipes/localized-parse-uuid.pipe';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Wallet address, username, or email already exists' })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get paginated list of active users' })
  @ApiResponse({ status: 200, description: 'Paginated users list' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.usersService.paginate(pagination);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
    return this.usersService.findById(userId, userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Username or email already taken' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate current user account (soft delete)' })
  @ApiResponse({ status: 204, description: 'User deactivated' })
  @ApiResponse({ status: 400, description: 'Already deactivated' })
  async deactivate(@CurrentUser('id') userId: string): Promise<void> {
    return this.usersService.deactivate(userId);
  }

  @Get('username/:username')
  @Public()
  @ApiOperation({ summary: 'Get user by username' })
  @ApiParam({ name: 'username', description: 'Username' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findByUsername(@Param('username') username: string): Promise<UserResponseDto> {
    return this.usersService.findByUsername(username);
  }

  @Get('wallet/:walletAddress')
  @Public()
  @ApiOperation({ summary: 'Get user by wallet address' })
  @ApiParam({ name: 'walletAddress', description: 'Stellar wallet address' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findByWalletAddress(
    @Param('walletAddress') walletAddress: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findByWalletAddress(walletAddress);
  }

  @UseGuards(BlockGuard)
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(@Param('id', LocalizedParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }
}
