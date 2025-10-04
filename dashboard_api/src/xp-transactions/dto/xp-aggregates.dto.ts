export class XPAggregatesDto {
  totalXP: number;
  transactionCount: number;
  averageXP: number;
  topUsers: Array<{ userId: string; username: string; totalXP: number }>;
  distributionByType: Record<ActionType, number>;
  timeline: Array<{ date: string; totalXP: number }>;
}
