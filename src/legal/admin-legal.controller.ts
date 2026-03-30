import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { CreateLegalDocumentDto } from './dto/legal-document.dto';
import { LegalService } from './legal.service';

@ApiTags('admin-legal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/legal')
export class AdminLegalController {
  constructor(private readonly legalService: LegalService) {}

  @Post()
  @ApiOperation({ summary: 'Create legal document draft' })
  createDraft(@Body() dto: CreateLegalDocumentDto, @CurrentUser() user: UserResponseDto) {
    return this.legalService.createDraft(dto, user.id);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish legal document draft' })
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserResponseDto) {
    return this.legalService.publishDocument(id, user.id);
  }
}
