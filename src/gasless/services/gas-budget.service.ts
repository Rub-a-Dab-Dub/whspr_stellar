import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GasBudget } from '../entities/gas-budget.entity';

@Injectable()
export class GasBudgetService {
  constructor(
    @InjectRepository(GasBudget)
    private readonly repo: Repository<GasBudget>,
  ) {}

  async canSpend(userId: string, amount: number): Promise<boolean> {
    const budget = await this.repo.findOneBy({ userId });
    return budget ? budget.used + amount <= budget.dailyLimit : false;
  }

  async spend(userId: string, amount: number): Promise<void> {
    const budget = await this.repo.findOneBy({ userId });
    if (!budget) return;

    budget.used += amount;
    await this.repo.save(budget);
  }
}
