import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation, ConversationType } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { InChatTransfersService } from '../in-chat-transfers/in-chat-transfers.service';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import { UsersRepository } from '../users/users.repository';
import { CreateGroupExpenseDto, SplitInputDto } from './dto/create-group-expense.dto';
import { GetGroupExpensesQueryDto } from './dto/get-group-expenses-query.dto';
import {
  GroupBalanceMemberSummaryDto,
  GroupBalanceResponseDto,
  GroupExpenseListResponseDto,
  GroupExpenseResponseDto,
  GroupUnsettledBalanceDto,
} from './dto/group-expense-response.dto';
import { UpdateExpenseSplitsDto, UpdateSplitInputDto } from './dto/update-expense-splits.dto';
import { ExpenseSplit } from './entities/expense-split.entity';
import {
  GroupExpense,
  GroupExpenseSplitType,
  GroupExpenseStatus,
} from './entities/group-expense.entity';

type SplitDraft = {
  userId: string;
  amountOwed: bigint;
};

const STROOPS_FACTOR = 10_000_000;

@Injectable()
export class GroupExpensesService {
  constructor(
    @InjectRepository(GroupExpense)
    private readonly expensesRepository: Repository<GroupExpense>,
    @InjectRepository(ExpenseSplit)
    private readonly splitsRepository: Repository<ExpenseSplit>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantsRepository: Repository<ConversationParticipant>,
    private readonly usersRepository: UsersRepository,
    private readonly inChatTransfersService: InChatTransfersService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async createExpense(
    groupId: string,
    createdBy: string,
    dto: CreateGroupExpenseDto,
  ): Promise<GroupExpenseResponseDto> {
    const conversation = await this.getGroupConversationOrThrow(groupId);
    const participants = await this.getParticipantIds(conversation.id);
    this.assertParticipant(participants, createdBy);

    const totalAmount = this.toStroops(dto.totalAmount);
    const splitDrafts = this.buildSplitDrafts(
      participants,
      createdBy,
      totalAmount,
      dto.splitType,
      dto.splits ?? [],
    );

    const expense = await this.expensesRepository.save(
      this.expensesRepository.create({
        groupId,
        conversationId: conversation.id,
        createdBy,
        title: dto.title.trim(),
        totalAmount: this.fromStroops(totalAmount),
        tokenId: dto.tokenId.trim().toUpperCase(),
        splitType: dto.splitType,
        status: this.computeStatus(splitDrafts.map((draft) => this.fromStroops(draft.amountOwed)), []),
      }),
    );

    const splits = await this.splitsRepository.save(
      splitDrafts.map((draft) =>
        this.splitsRepository.create({
          expenseId: expense.id,
          userId: draft.userId,
          amountOwed: this.fromStroops(draft.amountOwed),
          amountPaid: draft.userId === createdBy ? this.fromStroops(draft.amountOwed) : '0.0000000',
          isPaid: draft.userId === createdBy,
          paidAt: draft.userId === createdBy ? new Date() : null,
        }),
      ),
    );

    expense.status = this.computeStatus(
      splits.map((split) => split.amountOwed),
      splits.map((split) => split.amountPaid),
    );
    await this.expensesRepository.save(expense);

    const dtoResponse = this.toExpenseDto({ ...expense, splits });
    await this.chatGateway.sendExpenseNew(conversation.id, dtoResponse);
    return dtoResponse;
  }

  async updateSplits(
    expenseId: string,
    actorUserId: string,
    dto: UpdateExpenseSplitsDto,
  ): Promise<GroupExpenseResponseDto> {
    const expense = await this.getExpenseOrThrow(expenseId);
    if (expense.createdBy !== actorUserId) {
      throw new ForbiddenException('Only the expense creator can update splits.');
    }

    const participants = await this.getParticipantIds(expense.conversationId);
    const totalAmount = this.toStroops(expense.totalAmount);
    const splitDrafts = this.buildSplitDrafts(
      participants,
      expense.createdBy,
      totalAmount,
      dto.splitType,
      dto.splits,
    );

    const existingSplits = await this.splitsRepository.find({ where: { expenseId } });
    const existingByUser = new Map(existingSplits.map((split) => [split.userId, split]));

    const nextSplits = splitDrafts.map((draft) => {
      const current = existingByUser.get(draft.userId);
      const currentPaid = current ? this.toStroops(current.amountPaid) : BigInt(0);
      const cappedPaid = currentPaid > draft.amountOwed ? draft.amountOwed : currentPaid;
      const isPaid = cappedPaid >= draft.amountOwed;
      const paidAt = isPaid ? (current?.paidAt ?? new Date()) : null;

      return this.splitsRepository.create({
        expenseId,
        userId: draft.userId,
        amountOwed: this.fromStroops(draft.amountOwed),
        amountPaid: this.fromStroops(cappedPaid),
        isPaid,
        paidAt,
      });
    });

    await this.splitsRepository.delete({ expenseId });
    const savedSplits = await this.splitsRepository.save(nextSplits);

    expense.splitType = dto.splitType;
    expense.status = this.computeStatus(
      savedSplits.map((split) => split.amountOwed),
      savedSplits.map((split) => split.amountPaid),
    );
    await this.expensesRepository.save(expense);

    return this.toExpenseDto({ ...expense, splits: savedSplits });
  }

  async markPaid(
    expenseId: string,
    userId: string,
    amount: string,
    markPaidAt: Date = new Date(),
  ): Promise<GroupExpenseResponseDto> {
    const expense = await this.getExpenseOrThrow(expenseId);
    const split = await this.splitsRepository.findOne({ where: { expenseId, userId } });
    if (!split) {
      throw new NotFoundException('Split not found for this user.');
    }

    const amountToApply = this.toStroops(amount);
    if (amountToApply <= BigInt(0)) {
      throw new BadRequestException('Paid amount must be greater than zero.');
    }

    const amountPaid = this.toStroops(split.amountPaid);
    const amountOwed = this.toStroops(split.amountOwed);
    const nextPaid = amountPaid + amountToApply;

    if (nextPaid > amountOwed) {
      throw new BadRequestException('Paid amount exceeds the owed split amount.');
    }

    split.amountPaid = this.fromStroops(nextPaid);
    split.isPaid = nextPaid >= amountOwed;
    split.paidAt = split.isPaid ? markPaidAt : split.paidAt;
    await this.splitsRepository.save(split);

    const splits = await this.splitsRepository.find({ where: { expenseId } });
    expense.status = this.computeStatus(
      splits.map((item) => item.amountOwed),
      splits.map((item) => item.amountPaid),
    );
    await this.expensesRepository.save(expense);

    return this.toExpenseDto({ ...expense, splits });
  }

  async settleViaTransfer(expenseId: string, payerUserId: string): Promise<GroupExpenseResponseDto> {
    const expense = await this.getExpenseOrThrow(expenseId);
    const split = await this.splitsRepository.findOne({
      where: { expenseId, userId: payerUserId },
    });
    if (!split) {
      throw new NotFoundException('Split not found for this user.');
    }
    if (expense.createdBy === payerUserId) {
      throw new BadRequestException('Expense creator cannot settle against themselves.');
    }

    const remaining = this.toStroops(split.amountOwed) - this.toStroops(split.amountPaid);
    if (remaining <= BigInt(0)) {
      throw new BadRequestException('This split is already fully settled.');
    }

    const creator = await this.usersRepository.findOne({
      where: { id: expense.createdBy },
      select: ['id', 'username'],
    });
    if (!creator) {
      throw new NotFoundException('Expense creator not found.');
    }
    if (!creator.username) {
      throw new BadRequestException('Expense creator is missing a username for in-chat settlement.');
    }

    const rawCommand = `/send @${creator.username} ${this.fromStroops(remaining)} ${expense.tokenId}`;
    const preview = await this.inChatTransfersService.initiateTransfer(
      payerUserId,
      expense.conversationId,
      { rawCommand },
    );
    const confirmed = await this.inChatTransfersService.confirmTransfer(preview.transferId, payerUserId);

    if (confirmed.status !== 'completed') {
      throw new BadRequestException('On-chain settlement failed to confirm.');
    }

    const updated = await this.markPaid(expenseId, payerUserId, this.fromStroops(remaining));
    await this.chatGateway.sendExpenseSettled(expense.conversationId, updated);
    return updated;
  }

  async getExpenses(
    groupId: string,
    userId: string,
    query: GetGroupExpensesQueryDto,
  ): Promise<GroupExpenseListResponseDto> {
    const conversation = await this.getGroupConversationOrThrow(groupId);
    const participants = await this.getParticipantIds(conversation.id);
    this.assertParticipant(participants, userId);

    const where: { groupId: string; status?: GroupExpenseStatus } = { groupId };
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.expensesRepository.findAndCount({
      where,
      relations: ['splits'],
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      items: items.map((item) => this.toExpenseDto(item)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getUnsettledBalance(groupId: string, userId: string): Promise<GroupUnsettledBalanceDto> {
    const summary = await this.getGroupBalanceSummary(groupId, userId);
    const current = summary.find((item) => item.userId === userId) ?? {
      userId,
      netOwed: '0.0000000',
      netOwedTo: '0.0000000',
    };

    const totalOwed = current.netOwed;
    const totalOwedTo = current.netOwedTo;
    const netBalance = this.fromStroops(this.toStroops(totalOwedTo) - this.toStroops(totalOwed));

    return {
      userId,
      totalOwed,
      totalOwedTo,
      netBalance,
    };
  }

  async getGroupBalanceSummary(
    groupId: string,
    userId: string,
  ): Promise<GroupBalanceMemberSummaryDto[]> {
    const conversation = await this.getGroupConversationOrThrow(groupId);
    const participants = await this.getParticipantIds(conversation.id);
    this.assertParticipant(participants, userId);

    const expenses = await this.expensesRepository.find({
      where: {
        groupId,
        status: In([GroupExpenseStatus.OPEN, GroupExpenseStatus.PARTIALLY_SETTLED]),
      },
      relations: ['splits'],
    });

    const summary = new Map<string, { netOwed: bigint; netOwedTo: bigint }>();
    for (const participantId of participants) {
      summary.set(participantId, { netOwed: BigInt(0), netOwedTo: BigInt(0) });
    }

    for (const expense of expenses) {
      for (const split of expense.splits ?? []) {
        if (split.userId === expense.createdBy) {
          continue;
        }
        const remaining = this.toStroops(split.amountOwed) - this.toStroops(split.amountPaid);
        if (remaining <= BigInt(0)) {
          continue;
        }

        const debtor = summary.get(split.userId);
        const creditor = summary.get(expense.createdBy);
        if (debtor) {
          debtor.netOwed += remaining;
        }
        if (creditor) {
          creditor.netOwedTo += remaining;
        }
      }
    }

    return Array.from(summary.entries()).map(([memberId, balances]) => ({
      userId: memberId,
      netOwed: this.fromStroops(balances.netOwed),
      netOwedTo: this.fromStroops(balances.netOwedTo),
    }));
  }

  async getBalanceView(groupId: string, userId: string): Promise<GroupBalanceResponseDto> {
    const [summary, unsettledBalance] = await Promise.all([
      this.getGroupBalanceSummary(groupId, userId),
      this.getUnsettledBalance(groupId, userId),
    ]);

    return {
      groupId,
      unsettledBalance,
      summary,
    };
  }

  private async getExpenseOrThrow(expenseId: string): Promise<GroupExpense> {
    const expense = await this.expensesRepository.findOne({
      where: { id: expenseId },
      relations: ['splits'],
    });
    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }
    return expense;
  }

  private async getGroupConversationOrThrow(groupId: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { chainGroupId: groupId, type: ConversationType.GROUP },
    });
    if (!conversation) {
      throw new NotFoundException('Group conversation not found.');
    }
    return conversation;
  }

  private async getParticipantIds(conversationId: string): Promise<string[]> {
    const participants = await this.participantsRepository.find({
      where: { conversationId },
      select: ['userId'],
    });
    return participants.map((item) => item.userId);
  }

  private assertParticipant(participants: string[], userId: string): void {
    if (!participants.includes(userId)) {
      throw new ForbiddenException('User is not a participant in this group conversation.');
    }
  }

  private buildSplitDrafts(
    participantIds: string[],
    createdBy: string,
    totalAmount: bigint,
    splitType: GroupExpenseSplitType,
    splits: Array<SplitInputDto | UpdateSplitInputDto>,
  ): SplitDraft[] {
    const participantSet = new Set(participantIds);
    if (!participantSet.has(createdBy)) {
      throw new BadRequestException('Expense creator must be a group participant.');
    }

    if (splitType === GroupExpenseSplitType.EQUAL) {
      const baseShare = totalAmount / BigInt(participantIds.length);
      const remainder = totalAmount % BigInt(participantIds.length);
      return participantIds.map((participantId) => ({
        userId: participantId,
        amountOwed: baseShare + (participantId === createdBy ? remainder : BigInt(0)),
      }));
    }

    if (!splits.length) {
      throw new BadRequestException('Splits are required for CUSTOM and PERCENTAGE split types.');
    }

    const seen = new Set<string>();
    for (const split of splits) {
      if (!participantSet.has(split.userId)) {
        throw new BadRequestException(`User ${split.userId} is not in the group conversation.`);
      }
      if (seen.has(split.userId)) {
        throw new BadRequestException(`Duplicate split user ${split.userId}.`);
      }
      seen.add(split.userId);
    }

    if (splitType === GroupExpenseSplitType.CUSTOM) {
      const drafts = splits.map((split) => {
        if (split.amount === undefined) {
          throw new BadRequestException('Custom split entries require amount.');
        }
        return {
          userId: split.userId,
          amountOwed: this.toStroops(split.amount),
        };
      });

      const total = drafts.reduce((acc, split) => acc + split.amountOwed, BigInt(0));
      if (total !== totalAmount) {
        throw new BadRequestException('Custom split amounts must sum to the expense total.');
      }

      return drafts;
    }

    const percentageEntries = splits.map((split) => {
      if (split.percentage === undefined) {
        throw new BadRequestException('Percentage split entries require percentage.');
      }
      return {
        userId: split.userId,
        percentage: split.percentage,
      };
    });

    const totalPercentage = percentageEntries.reduce((acc, split) => acc + split.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.0001) {
      throw new BadRequestException('Percentage splits must total 100%.');
    }

    const drafts = percentageEntries.map((entry) => ({
      userId: entry.userId,
      amountOwed: this.percentageToAmount(totalAmount, entry.percentage),
    }));

    const distributed = drafts.reduce((acc, split) => acc + split.amountOwed, BigInt(0));
    const remainder = totalAmount - distributed;
    if (remainder !== BigInt(0)) {
      const creatorSplit =
        drafts.find((split) => split.userId === createdBy) ??
        (() => {
          const empty = { userId: createdBy, amountOwed: BigInt(0) };
          drafts.push(empty);
          return empty;
        })();
      creatorSplit.amountOwed += remainder;
    }

    const postTotal = drafts.reduce((acc, split) => acc + split.amountOwed, BigInt(0));
    if (postTotal !== totalAmount) {
      throw new BadRequestException('Percentage split calculation failed validation.');
    }

    return drafts;
  }

  private computeStatus(owedAmounts: string[], paidAmounts: string[]): GroupExpenseStatus {
    if (!owedAmounts.length || owedAmounts.length !== paidAmounts.length) {
      return GroupExpenseStatus.OPEN;
    }
    let paidCount = 0;
    for (let i = 0; i < owedAmounts.length; i += 1) {
      const owed = this.toStroops(owedAmounts[i]);
      const paid = this.toStroops(paidAmounts[i]);
      if (paid >= owed) {
        paidCount += 1;
      }
    }
    if (paidCount === owedAmounts.length) {
      return GroupExpenseStatus.SETTLED;
    }
    if (paidCount > 0) {
      return GroupExpenseStatus.PARTIALLY_SETTLED;
    }
    return GroupExpenseStatus.OPEN;
  }

  private percentageToAmount(totalAmount: bigint, percentage: number): bigint {
    const bps = BigInt(Math.round(percentage * 10_000));
    return (totalAmount * bps) / BigInt(1_000_000);
  }

  private toStroops(value: number | string): bigint {
    const amount = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Invalid amount.');
    }
    return BigInt(Math.round(amount * STROOPS_FACTOR));
  }

  private fromStroops(value: bigint): string {
    return (Number(value) / STROOPS_FACTOR).toFixed(7);
  }

  private toExpenseDto(expense: GroupExpense): GroupExpenseResponseDto {
    return {
      id: expense.id,
      groupId: expense.groupId,
      conversationId: expense.conversationId,
      createdBy: expense.createdBy,
      title: expense.title,
      totalAmount: expense.totalAmount,
      tokenId: expense.tokenId,
      splitType: expense.splitType,
      status: expense.status,
      createdAt: expense.createdAt,
      splits: (expense.splits ?? []).map((split) => ({
        expenseId: split.expenseId,
        userId: split.userId,
        amountOwed: split.amountOwed,
        amountPaid: split.amountPaid,
        isPaid: split.isPaid,
        paidAt: split.paidAt,
      })),
    };
  }
}
