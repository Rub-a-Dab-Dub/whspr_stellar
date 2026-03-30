import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CastVoteDto, CreateProposalDto, DepositDto } from './dto/treasury.dto';
import { DaoTreasuryService } from './dao-treasury.service';

@ApiTags('dao-treasury')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DaoTreasuryController {
  constructor(private readonly service: DaoTreasuryService) {}

  @Get('groups/:id/treasury')
  @ApiOperation({ summary: 'Get treasury state (balance synced from chain)' })
  getTreasury(@Param('id', ParseUUIDPipe) groupId: string) {
    return this.service.getBalance(groupId);
  }

  @Post('groups/:id/treasury/deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deposit tokens into group treasury' })
  deposit(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: DepositDto,
  ) {
    return this.service.deposit(groupId, dto);
  }

  @Post('groups/:id/treasury/proposals')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a spending proposal' })
  createProposal(
    @Param('id', ParseUUIDPipe) groupId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProposalDto,
  ) {
    return this.service.createProposal(groupId, userId, dto);
  }

  @Get('groups/:id/treasury/proposals')
  @ApiOperation({ summary: 'List proposals for a group treasury' })
  getProposals(@Param('id', ParseUUIDPipe) groupId: string) {
    return this.service.getProposals(groupId);
  }

  @Post('proposals/:id/vote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cast a FOR/AGAINST vote on a proposal' })
  castVote(
    @Param('id', ParseUUIDPipe) proposalId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CastVoteDto,
  ) {
    return this.service.castVote(userId, proposalId, dto);
  }

  @Post('proposals/:id/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a passed proposal via Soroban contract' })
  executeProposal(@Param('id', ParseUUIDPipe) proposalId: string) {
    return this.service.executeProposal(proposalId);
  }
}
