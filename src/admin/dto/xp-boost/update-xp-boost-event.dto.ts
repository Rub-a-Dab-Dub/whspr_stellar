import { PartialType } from '@nestjs/swagger';
import { CreateXpBoostEventDto } from './create-xp-boost-event.dto';

export class UpdateXpBoostEventDto extends PartialType(CreateXpBoostEventDto) {}
