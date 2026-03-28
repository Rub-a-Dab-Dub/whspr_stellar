import { Controller, Get, Post, Query, Body, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { Sep10Service } from './sep10.service';
import { Sep10ChallengeResponseDto } from './dto/sep10-challenge-response.dto';
import { Sep10VerifyRequestDto } from './dto/sep10-verify-request.dto';
import { Sep10TokenResponseDto } from './dto/sep10-token-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('sep10')
@Controller()
export class Sep10Controller {
  constructor(private readonly sep10Service: Sep10Service) {}

  @Get('.well-known/stellar.toml')
  @Public()
  @ApiOperation({ summary: 'Stellar TOML metadata (SEP-1)' })
  @ApiResponse({ status: 200, description: 'stellar.toml content' })
  getStellarToml(@Res() res: Response): void {
    const toml = [
      `ACCOUNTS=["${this.sep10Service.serverPublicKey}"]`,
      `VERSION="2.0.0"`,
      `NETWORK_PASSPHRASE="${this.sep10Service['networkPassphrase']}"`,
      ``,
      `[DOCUMENTATION]`,
      `ORG_NAME="Whspr Stellar"`,
      ``,
      `[[PRINCIPALS]]`,
      `name="Whspr Stellar"`,
      ``,
      `[WEB_AUTH]`,
      `WEB_AUTH_ENDPOINT="${this.sep10Service.tomlWebAuthEndpoint}"`,
      `SIGNING_KEY="${this.sep10Service.serverPublicKey}"`,
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(toml);
  }

  @Get('auth')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'GET SEP-10 challenge transaction' })
  @ApiQuery({ name: 'account', description: 'Stellar account address (G...)', required: true })
  @ApiResponse({ status: 200, type: Sep10ChallengeResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid account address' })
  getChallenge(@Query('account') account: string): Sep10ChallengeResponseDto {
    const transaction = this.sep10Service.buildChallenge(account);
    return {
      transaction,
      network_passphrase: this.sep10Service['networkPassphrase'],
    };
  }

  @Post('auth')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'POST signed SEP-10 challenge, receive JWT' })
  @ApiResponse({ status: 200, type: Sep10TokenResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Invalid or expired challenge' })
  verifyChallenge(@Body() body: Sep10VerifyRequestDto): Sep10TokenResponseDto {
    const token = this.sep10Service.verifyChallenge(body.transaction, body.account);
    return { token };
  }
}
