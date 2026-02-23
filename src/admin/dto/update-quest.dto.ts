import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateQuestDto } from './create-quest.dto';

export class UpdateQuestDto extends PartialType(
  OmitType(CreateQuestDto, ['createdBy'] as const),
) {}
