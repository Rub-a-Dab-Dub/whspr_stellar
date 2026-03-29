import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrencyConversionService } from '../services/currency-conversion.service';
import {
  CurrencyRateDto,
  ConversionResultDto,
  AllRatesResponseDto,
  CurrencyPreferenceResponseDto,
} from '../dto/currency.dto';
import {
  SetDisplayCurrencyDto,
  ConvertCurrencyQueryDto,
  BatchConvertDto,
} from '../dto/currency-input.dto.ts';
import { CurrencyPreferenceRepository } from '../repositories/currency-preference.repository';

@ApiTags('Currency & Conversion')
@Controller('currency')
export class CurrencyController {
  constructor(
    private readonly currencyConversionService: CurrencyConversionService,
    private readonly currencyPreferenceRepository: CurrencyPreferenceRepository,
  ) {}

  /**
   * Get all available exchange rates
   * Returns both crypto-to-fiat and fiat-to-fiat rates
   */
  @Get('rates')
  @ApiOperation({
    summary: 'Get all exchange rates',
    description: 'Fetch all cached exchange rates (crypto-to-fiat and fiat-to-fiat)',
  })
  @ApiResponse({
    status: 200,
    description: 'All exchange rates',
    type: AllRatesResponseDto,
  })
  async getAllRates(): Promise<AllRatesResponseDto> {
    // Trigger refresh to ensure latest rates
    await this.currencyConversionService.refreshRates();

    return new AllRatesResponseDto({
      cryptoRates: {}, // In production, return actual cached rates
      fiatRates: {}, // In production, return actual cached rates
      lastUpdated: new Date(),
    });
  }

  /**
   * Convert amount from one currency to another
   * Supports crypto-to-fiat, fiat-to-crypto, and fiat-to-fiat conversions
   */
  @Get('convert')
  @ApiOperation({
    summary: 'Convert currency amount',
    description:
      'Convert an amount from one currency to another. Supports crypto-to-fiat, fiat-to-fiat, and cross-fiat conversions.',
  })
  @ApiQuery({ name: 'from', example: 'USD', description: 'Source currency' })
  @ApiQuery({ name: 'to', example: 'NGN', description: 'Target currency' })
  @ApiQuery({ name: 'amount', example: 100, description: 'Amount to convert' })
  @ApiResponse({
    status: 200,
    description: 'Conversion result with formatted output',
    type: ConversionResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid currency pair or amount',
  })
  async convertCurrency(
    @Query() query: ConvertCurrencyQueryDto,
  ): Promise<ConversionResultDto> {
    try {
      const result = await this.currencyConversionService.convert(
        query.amount,
        query.from,
        query.to,
      );

      const rate = await this.currencyConversionService.getRate(
        query.from,
        query.to,
      );

      const formatted = this.currencyConversionService.formatAmount(
        result,
        query.to,
      );

      return plainToInstance(
        ConversionResultDto,
        {
          amount: query.amount,
          from: query.from,
          to: query.to,
          result,
          rate,
          formatted,
        },
        { excludeExtraneousValues: true },
      );
    } catch (error) {
      throw new BadRequestException(
        `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get current user's display currency preference
   */
  @Get('settings/currency')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user currency preference',
    description: 'Get the current user\'s preferred display currency',
  })
  @ApiResponse({
    status: 200,
    description: 'User currency preference',
    type: CurrencyPreferenceResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getUserCurrencyPreference(
    @CurrentUser('id') userId: string,
  ): Promise<CurrencyPreferenceResponseDto> {
    const preference =
      await this.currencyPreferenceRepository.getOrCreatePreference(userId);

    return plainToInstance(CurrencyPreferenceResponseDto, preference, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Update user's display currency preference
   */
  @Patch('settings/currency')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user currency preference',
    description: 'Update the current user\'s preferred display currency',
  })
  @ApiResponse({
    status: 200,
    description: 'Preference updated successfully',
    type: CurrencyPreferenceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid currency code',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateUserCurrencyPreference(
    @CurrentUser('id') userId: string,
    @Body() dto: SetDisplayCurrencyDto,
  ): Promise<CurrencyPreferenceResponseDto> {
    await this.currencyConversionService.setDisplayCurrency(
      userId,
      dto.displayCurrency,
    );

    const preference =
      await this.currencyPreferenceRepository.getOrCreatePreference(userId);

    return plainToInstance(CurrencyPreferenceResponseDto, preference, {
      excludeExtraneousValues: true,
    });
  }
}
