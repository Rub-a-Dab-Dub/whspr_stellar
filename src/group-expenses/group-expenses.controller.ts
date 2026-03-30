import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LocalizedParseUUIDPipe } from '../i18n/pipes/localized-parse-uuid.pipe';
import { CreateGroupExpenseDto } from './dto/create-group-expense.dto';
import { GetGroupExpensesQueryDto } from './dto/get-group-expenses-query.dto';
import {
  GroupBalanceResponseDto,
  GroupExpenseListResponseDto,
  GroupExpenseResponseDto,
} from './dto/group-expense-response.dto';
import { UpdateExpenseSplitsDto } from './dto/update-expense-splits.dto';
import { GroupExpensesService } from './group-expenses.service';

@ApiTags('group-expenses')
@ApiBearerAuth()
@Controller()
export class GroupExpensesController {
  constructor(private readonly groupExpensesService: GroupExpensesService) {}

  @Post('groups/:id/expenses')
  @ApiOperation({ summary: 'Create a group expense' })
  @ApiResponse({ status: 201, type: GroupExpenseResponseDto })
  createExpense(
    @Param('id') groupId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGroupExpenseDto,
  ): Promise<GroupExpenseResponseDto> {
    return this.groupExpensesService.createExpense(groupId, userId, dto);
  }

  @Get('groups/:id/expenses')
  @ApiOperation({ summary: 'List group expenses with pagination and status filter' })
  @ApiResponse({ status: 200, type: GroupExpenseListResponseDto })
  getExpenses(
    @Param('id') groupId: string,
    @CurrentUser('id') userId: string,
    @Query() query: GetGroupExpensesQueryDto,
  ): Promise<GroupExpenseListResponseDto> {
    return this.groupExpensesService.getExpenses(groupId, userId, query);
  }

  @Get('groups/:id/expenses/balance')
  @ApiOperation({ summary: 'Get unsettled balance and group balance summary' })
  @ApiResponse({ status: 200, type: GroupBalanceResponseDto })
  getBalance(
    @Param('id') groupId: string,
    @CurrentUser('id') userId: string,
  ): Promise<GroupBalanceResponseDto> {
    return this.groupExpensesService.getBalanceView(groupId, userId);
  }

  @Post('expenses/:id/settle')
  @ApiOperation({ summary: 'Settle an expense split through in-chat transfer' })
  @ApiResponse({ status: 201, type: GroupExpenseResponseDto })
  settleExpense(
    @Param('id', LocalizedParseUUIDPipe) expenseId: string,
    @CurrentUser('id') userId: string,
  ): Promise<GroupExpenseResponseDto> {
    return this.groupExpensesService.settleViaTransfer(expenseId, userId);
  }

  @Patch('expenses/:id/splits')
  @ApiOperation({ summary: 'Update expense splits' })
  @ApiResponse({ status: 200, type: GroupExpenseResponseDto })
  updateExpenseSplits(
    @Param('id', LocalizedParseUUIDPipe) expenseId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateExpenseSplitsDto,
  ): Promise<GroupExpenseResponseDto> {
    return this.groupExpensesService.updateSplits(expenseId, userId, dto);
  }
}
