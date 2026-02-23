import { PartialType } from '@nestjs/swagger';
import { CreateMaintainanceDto } from './create-maintainance.dto';

export class UpdateMaintainanceDto extends PartialType(CreateMaintainanceDto) {}
