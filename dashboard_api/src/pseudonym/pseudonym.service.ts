import { Injectable } from '@nestjs/common';
import { CreatePseudonymDto } from './dto/create-pseudonym.dto';
import { UpdatePseudonymDto } from './dto/update-pseudonym.dto';

@Injectable()
export class PseudonymService {
  create(createPseudonymDto: CreatePseudonymDto) {
    return 'This action adds a new pseudonym';
  }

  findAll() {
    return `This action returns all pseudonym`;
  }

  findOne(id: number) {
    return `This action returns a #${id} pseudonym`;
  }

  update(id: number, updatePseudonymDto: UpdatePseudonymDto) {
    return `This action updates a #${id} pseudonym`;
  }

  remove(id: number) {
    return `This action removes a #${id} pseudonym`;
  }
}
