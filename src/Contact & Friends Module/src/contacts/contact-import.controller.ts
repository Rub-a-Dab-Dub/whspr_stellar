import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { ContactImportService } from './contact-import.service';
import { ImportContactsDto } from './dto/import-contacts.dto';
import {
  AddAllMatchedContactsResponseDto,
  ImportContactsResponseDto,
  MatchedUserDto,
} from './dto/contact-import-response.dto';

@UseGuards(JwtAuthGuard)
@Controller('contacts/import')
export class ContactImportController {
  constructor(private readonly contactImportService: ContactImportService) {}

  @Post()
  importContacts(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImportContactsDto,
  ): Promise<ImportContactsResponseDto> {
    return this.contactImportService.importContacts(user.sub, dto);
  }

  @Get('matches')
  getMatches(@CurrentUser() user: JwtPayload): Promise<MatchedUserDto[]> {
    return this.contactImportService.getMatches(user.sub);
  }

  @Post('add-all')
  addAllMatchedAsContacts(
    @CurrentUser() user: JwtPayload,
  ): Promise<AddAllMatchedContactsResponseDto> {
    return this.contactImportService.addMatchedAsContact(user.sub);
  }
}
