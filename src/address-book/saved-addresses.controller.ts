import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LocalizedParseUUIDPipe } from '../i18n/pipes/localized-parse-uuid.pipe';
import {
  CreateSavedAddressDto,
  SavedAddressResponseDto,
  SearchSavedAddressesDto,
  UpdateSavedAddressDto,
} from './dto/saved-address.dto';
import { SavedAddress } from './entities/saved-address.entity';
import { SavedAddressesService } from './saved-addresses.service';

@ApiTags('address-book')
@ApiBearerAuth()
@Controller('address-book')
export class SavedAddressesController {
  constructor(private readonly savedAddressesService: SavedAddressesService) {}

  @Post()
  @ApiOperation({ summary: 'Save an external Stellar address with alias metadata' })
  @ApiResponse({ status: 201, type: SavedAddressResponseDto })
  addAddress(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSavedAddressDto,
  ): Promise<SavedAddress> {
    return this.savedAddressesService.addAddress(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List saved addresses sorted by lastUsedAt DESC by default' })
  @ApiResponse({ status: 200, type: [SavedAddressResponseDto] })
  getAddresses(@CurrentUser('id') userId: string): Promise<SavedAddress[]> {
    return this.savedAddressesService.getAddresses(userId);
  }

  @Get('search')
  @ApiOperation({
    summary:
      'Search saved addresses by alias, address, or tag; supports suggest mode for transfer autocomplete',
  })
  @ApiResponse({ status: 200, type: [SavedAddressResponseDto] })
  searchAddresses(
    @CurrentUser('id') userId: string,
    @Query() query: SearchSavedAddressesDto,
  ): Promise<SavedAddress[]> {
    return this.savedAddressesService.searchAddresses(userId, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update alias, avatar, network, or tags for a saved address' })
  @ApiParam({ name: 'id', description: 'Saved address UUID' })
  @ApiResponse({ status: 200, type: SavedAddressResponseDto })
  updateAddress(
    @CurrentUser('id') userId: string,
    @Param('id', LocalizedParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedAddressDto,
  ): Promise<SavedAddress> {
    return this.savedAddressesService.updateAddress(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a saved address' })
  @ApiParam({ name: 'id', description: 'Saved address UUID' })
  async deleteAddress(
    @CurrentUser('id') userId: string,
    @Param('id', LocalizedParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.savedAddressesService.deleteAddress(userId, id);
  }
}
