import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CurrencyPreference, DisplayCurrency } from './entities/currency-preference.entity';

@Injectable()
export class CurrencyPreferenceRepository extends Repository<CurrencyPreference> {
  constructor(private dataSource: DataSource) {
    super(CurrencyPreference, dataSource.createEntityManager());
  }

  /**
   * Find currency preference by user ID
   */
  async findByUserId(userId: string): Promise<CurrencyPreference | null> {
    return this.findOne({
      where: { userId },
    });
  }

  /**
   * Get user's display currency, creating default (USD) if not exists
   */
  async getOrCreatePreference(userId: string): Promise<CurrencyPreference> {
    let preference = await this.findByUserId(userId);

    if (!preference) {
      preference = this.create({
        userId,
        displayCurrency: DisplayCurrency.USD, // Default to USD
      });
      await this.save(preference);
    }

    return preference;
  }

  /**
   * Update user's display currency preference
   */
  async updateDisplayCurrency(
    userId: string,
    currency: DisplayCurrency,
  ): Promise<CurrencyPreference> {
    let preference = await this.findByUserId(userId);

    if (!preference) {
      preference = this.create({
        userId,
        displayCurrency: currency,
      });
    } else {
      preference.displayCurrency = currency;
    }

    return this.save(preference);
  }

  /**
   * Get display currency for user, defaults to USD if not set
   */
  async getUserDisplayCurrency(userId: string): Promise<DisplayCurrency> {
    const preference = await this.findByUserId(userId);
    return preference?.displayCurrency || DisplayCurrency.USD;
  }
}
