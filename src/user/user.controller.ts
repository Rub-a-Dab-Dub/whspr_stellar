import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UsersService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    const email =
      typeof createUserDto.email === 'string' ? createUserDto.email : '';
    const password =
      typeof createUserDto.password === 'string' ? createUserDto.password : '';
    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }
    return this.userService.create(email, password);
  }

  @Get()
  findAll() {
    return [];
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    void id;
    void updateUserDto;
    return { success: true };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    void id;
    return { success: true };
  }
}
