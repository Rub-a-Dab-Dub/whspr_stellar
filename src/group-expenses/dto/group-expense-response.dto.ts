import { ApiProperty } from '@nestjs/swagger';
import {
  GroupExpenseSplitType,
  GroupExpenseStatus,
} from '../entities/group-expense.entity';

export class ExpenseSplitResponseDto {
  @ApiProperty()
  expenseId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  amountOwed!: string;

  @ApiProperty()
  amountPaid!: string;

  @ApiProperty()
  isPaid!: boolean;

  @ApiProperty({ nullable: true })
  paidAt!: Date | null;
}

export class GroupExpenseResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty()
  tokenId!: string;

  @ApiProperty({ enum: GroupExpenseSplitType })
  splitType!: GroupExpenseSplitType;

  @ApiProperty({ enum: GroupExpenseStatus })
  status!: GroupExpenseStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: [ExpenseSplitResponseDto] })
  splits!: ExpenseSplitResponseDto[];
}

export class GroupExpenseListResponseDto {
  @ApiProperty({ type: [GroupExpenseResponseDto] })
  items!: GroupExpenseResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class GroupBalanceMemberSummaryDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  netOwed!: string;

  @ApiProperty()
  netOwedTo!: string;
}

export class GroupUnsettledBalanceDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  totalOwed!: string;

  @ApiProperty()
  totalOwedTo!: string;

  @ApiProperty()
  netBalance!: string;
}

export class GroupBalanceResponseDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty({ type: GroupUnsettledBalanceDto })
  unsettledBalance!: GroupUnsettledBalanceDto;

  @ApiProperty({ type: [GroupBalanceMemberSummaryDto] })
  summary!: GroupBalanceMemberSummaryDto[];
}
