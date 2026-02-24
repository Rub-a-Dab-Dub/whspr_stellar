import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestDto } from './create-quest.dto';

export class UpdateQuestDto extends PartialType(CreateQuestDto) {}
