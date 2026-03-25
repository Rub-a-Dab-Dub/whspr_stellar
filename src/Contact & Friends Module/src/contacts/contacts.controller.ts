import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { ContactsService } from './contacts.service';
import { AddContactDto } from './dto/add-contact.dto';
import { ContactResponseDto, PaginatedContactsDto } from './dto/contact-response.dto';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  /** POST /contacts — send a contact request */
  @Post()
  addContact(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddContactDto,
  ): Promise<ContactResponseDto> {
    return this.contactsService.addContact(user.sub, dto);
  }

  /** GET /contacts?page=1&limit=20&search=alice */
  @Get()
  getContacts(
    @CurrentUser() user: JwtPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ): Promise<PaginatedContactsDto> {
    return this.contactsService.getContacts(user.sub, page, limit, search);
  }

  /** GET /contacts/blocked */
  @Get('blocked')
  getBlockedUsers(@CurrentUser() user: JwtPayload): Promise<ContactResponseDto[]> {
    return this.contactsService.getBlockedUsers(user.sub);
  }

  /** PATCH /contacts/:id/accept — accept a pending request */
  @Patch(':id/accept')
  acceptContact(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) contactId: string,
  ): Promise<ContactResponseDto> {
    return this.contactsService.acceptContact(user.sub, contactId);
  }

  /** DELETE /contacts/:id — remove a contact */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContact(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) contactId: string,
  ): Promise<void> {
    return this.contactsService.removeContact(user.sub, contactId);
  }

  /** POST /contacts/:id/block — block a user */
  @Post(':id/block')
  blockUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) targetId: string,
  ): Promise<ContactResponseDto> {
    return this.contactsService.blockUser(user.sub, targetId);
  }

  /** DELETE /contacts/:id/block — unblock a user */
  @Delete(':id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  unblockUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) targetId: string,
  ): Promise<void> {
    return this.contactsService.unblockUser(user.sub, targetId);
  }
}
