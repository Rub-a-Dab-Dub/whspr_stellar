import { PartialType } from '@nestjs/swagger';
import { CreatePseudonymDto } from './create-pseudonym.dto';

export class UpdatePseudonymDto extends PartialType(CreatePseudonymDto) {}
