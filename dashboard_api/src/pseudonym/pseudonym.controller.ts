import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PseudonymService } from './pseudonym.service';
import { CreatePseudonymDto } from './dto/create-pseudonym.dto';
import { UpdatePseudonymDto } from './dto/update-pseudonym.dto';

@Controller('pseudonym')
export class PseudonymController {
  constructor(private readonly pseudonymService: PseudonymService) {}

  @Post()
  create(@Body() createPseudonymDto: CreatePseudonymDto) {
    return this.pseudonymService.create(createPseudonymDto);
  }

  @Get()
  findAll() {
    return this.pseudonymService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pseudonymService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePseudonymDto: UpdatePseudonymDto) {
    return this.pseudonymService.update(+id, updatePseudonymDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pseudonymService.remove(+id);
  }
}
