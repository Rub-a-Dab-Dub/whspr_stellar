import { Controller, Get, Param, Query, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { QrCodeService } from './qr-code.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('qr')
@Controller('qr')
export class QrCodeController {
  constructor(private readonly qrCodeService: QrCodeService) {}

  @Get('wallet')
  @Public()
  @ApiOperation({ summary: 'QR code for a wallet address' })
  @ApiQuery({ name: 'address', required: true })
  @ApiQuery({ name: 'size', required: false })
  @ApiResponse({ status: 200, description: 'PNG image' })
  async walletQR(
    @Query('address') address: string,
    @Query('size') size: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const buf = await this.qrCodeService.generateWalletQR(address, size ? +size : undefined);
    this.sendPng(res, buf);
  }

  @Get('profile/:username')
  @Public()
  @ApiOperation({ summary: 'QR code for a user profile' })
  @ApiQuery({ name: 'size', required: false })
  async profileQR(
    @Param('username') username: string,
    @Query('size') size: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const buf = await this.qrCodeService.generateProfileQR(username, size ? +size : undefined);
    this.sendPng(res, buf);
  }

  @Get('group/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'QR code for a group invite' })
  @ApiQuery({ name: 'size', required: false })
  async groupQR(
    @Param('id') inviteCode: string,
    @Query('size') size: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const buf = await this.qrCodeService.generateGroupQR(inviteCode, size ? +size : undefined);
    this.sendPng(res, buf);
  }

  @Get('transfer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'QR code encoding a transfer (recipient + amount + token)' })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'amount', required: true })
  @ApiQuery({ name: 'token', required: true })
  @ApiQuery({ name: 'size', required: false })
  async transferQR(
    @Query('to') to: string,
    @Query('amount') amount: string,
    @Query('token') token: string,
    @Query('size') size: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const buf = await this.qrCodeService.generateTransferQR(
      to,
      amount,
      token,
      size ? +size : undefined,
    );
    this.sendPng(res, buf);
  }

  @Get('parse')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Parse and validate a deep link' })
  @ApiQuery({ name: 'link', required: true })
  parseDeepLink(@Query('link') link: string): object {
    return this.qrCodeService.parseDeepLink(link);
  }

  private sendPng(res: Response, buf: Buffer): void {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  }
}
