import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { XpService } from './xp.service';
import { CreateXpDto } from './dto/create-xp.dto';
import { UpdateXpDto } from './dto/update-xp.dto';

@Controller('xp')
export class XpController {
  constructor(private readonly xpService: XpService) {}

  @Post()
  create(@Body() createXpDto: CreateXpDto) {
    return this.xpService.create(createXpDto);
  }

  @Get()
  findAll() {
    return this.xpService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.xpService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateXpDto: UpdateXpDto) {
    return this.xpService.update(+id, updateXpDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.xpService.remove(+id);
  }
}
