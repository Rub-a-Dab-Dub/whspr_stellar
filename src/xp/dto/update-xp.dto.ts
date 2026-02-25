import { PartialType } from '@nestjs/swagger';
import { CreateXpDto } from './create-xp.dto';

export class UpdateXpDto extends PartialType(CreateXpDto) {}
