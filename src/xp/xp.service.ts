import { Injectable } from '@nestjs/common';
import { CreateXpDto } from './dto/create-xp.dto';
import { UpdateXpDto } from './dto/update-xp.dto';

@Injectable()
export class XpService {
  create(createXpDto: CreateXpDto) {
    return 'This action adds a new xp';
  }

  findAll() {
    return `This action returns all xp`;
  }

  findOne(id: number) {
    return `This action returns a #${id} xp`;
  }

  update(id: number, updateXpDto: UpdateXpDto) {
    return `This action updates a #${id} xp`;
  }

  remove(id: number) {
    return `This action removes a #${id} xp`;
  }
}
