import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Patch,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TokensService } from './tokens.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { TokenNetwork } from './entities/token.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tokens')
@UseGuards(JwtAuthGuard)
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTokenDto) {
    return this.tokensService.create(dto);
  }

  @Get()
  findAll(@Query('network') network?: TokenNetwork) {
    if (network) return this.tokensService.findByNetwork(network);
    return this.tokensService.findAll();
  }

  @Get('whitelisted')
  findWhitelisted() {
    return this.tokensService.findWhitelisted();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tokensService.findById(id);
  }

  @Get('address/:address')
  findByAddress(@Param('address') address: string) {
    return this.tokensService.findByAddress(address);
  }

  @Patch(':id/whitelist')
  whitelist(@Param('id') id: string) {
    return this.tokensService.whitelist(id);
  }

  @Patch(':id/unwhitelist')
  unwhitelist(@Param('id') id: string) {
    return this.tokensService.unwhitelist(id);
  }

  @Patch(':id/refresh-price')
  refreshPrice(@Param('id') id: string) {
    return this.tokensService.refreshPrice(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tokensService.remove(id);
  }
}
