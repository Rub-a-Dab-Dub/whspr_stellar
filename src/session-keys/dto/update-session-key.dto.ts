import { PartialType } from '@nestjs/swagger';
import { CreateSessionKeyDto } from './create-session-key.dto';

export class UpdateSessionKeyDto extends PartialType(CreateSessionKeyDto) {}
