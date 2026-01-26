import { UseGuards, applyDecorators } from '@nestjs/common';
import { MemberGuard } from '../guards/member.guard';

export const IsMember = () => applyDecorators(UseGuards(MemberGuard));
