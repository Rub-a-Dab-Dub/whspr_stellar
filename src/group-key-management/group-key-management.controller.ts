import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GroupKeyManagementService } from './group-key-management.service';
import { DistributeKeyDto } from './dto/group-key.dto';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupKeyManagementController {
  constructor(
    private readonly gkmService: GroupKeyManagementService,
  ) {}

  @Get(':id/key-bundle')
  getMyKeyBundle(
    @Param('id', ParseUUIDPipe) groupId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.gkmService.getMemberKeyBundle(groupId, userId);
  }

  @Get(':id/key/version')
  getActiveKeyVersion(@Param('id', ParseUUIDPipe) groupId: string) {
    return this.gkmService.getActiveKeyVersion(groupId);
  }

  @Post(':id/key/rotate')
  rotateKey(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body('memberIds') memberIds: string[],
  ) {
    return this.gkmService.rotateGroupKey(groupId, memberIds ?? []);
  }

  @Post(':id/key/distribute')
  distributeKey(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: DistributeKeyDto,
  ) {
    return this.gkmService.distributeToMember(groupId, dto);
  }
}
