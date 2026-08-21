import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FinancePlanningService } from './finance-planning.service';
import {
  CreateBudgetDto,
  CreateSavingsGoalDto,
  DepositSavingsDto,
} from './dto/finance-planning.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateBudgetDto, UpdateSavingsGoalDto } from './dto/update-finance-planning.dto';

@ApiTags('Finance Planning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance-planning')
export class FinancePlanningController {
  constructor(
    private readonly financePlanningService: FinancePlanningService,
  ) {}

  @Post('budgets')
  @ApiOperation({ summary: 'Set monthly budget limit for a category' })
  createBudget(@Req() req: any, @Body() dto: CreateBudgetDto) {
    return this.financePlanningService.createBudget(req.user.userId, dto);
  }

  @Get('budgets')
  @ApiOperation({ summary: 'Get category budgets for a specific month/year' })
  getBudgets(
    @Req() req: any,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.financePlanningService.getBudgets(
      req.user.userId,
      month,
      year,
    );
  }

  @Delete('budgets/:id')
  @ApiOperation({ summary: 'Delete a budget category limit' })
  deleteBudget(@Req() req: any, @Param('id') id: string) {
    return this.financePlanningService.deleteBudget(req.user.userId, id);
  }

  // --- SAVINGS GOALS ENDPOINTS ---

  @Post('savings')
  @ApiOperation({ summary: 'Create a new savings goal' })
  createSavingsGoal(@Req() req: any, @Body() dto: CreateSavingsGoalDto) {
    return this.financePlanningService.createSavingsGoal(req.user.userId, dto);
  }

  @Get('savings')
  @ApiOperation({ summary: 'Get all active savings goals' })
  getSavingsGoals(@Req() req: any) {
    return this.financePlanningService.getSavingsGoals(req.user.userId);
  }

  @Patch('savings/:id/deposit')
  @ApiOperation({ summary: 'Deposit funds toward a savings goal' })
  depositToSavings(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: DepositSavingsDto,
  ) {
    return this.financePlanningService.depositToSavings(
      req.user.userId,
      id,
      dto,
    );
  }

  @Delete('savings/:id')
  @ApiOperation({ summary: 'Delete a savings goal' })
  deleteSavingsGoal(@Req() req: any, @Param('id') id: string) {
    return this.financePlanningService.deleteSavingsGoal(req.user.userId, id);
  }

  // --- BUDGET UPDATE ---
@Patch('budgets/:id')
@ApiOperation({ summary: 'Update category budget limit or month/year' })
updateBudget(
  @Req() req: any,
  @Param('id') id: string,
  @Body() dto: UpdateBudgetDto,
) {
  return this.financePlanningService.updateBudget(req.user.userId, id, dto);
}

// --- SAVINGS GOAL UPDATE ---
@Patch('savings/:id')
@ApiOperation({ summary: 'Update savings goal title, target amount, or deadline' })
updateSavingsGoal(
  @Req() req: any,
  @Param('id') id: string,
  @Body() dto: UpdateSavingsGoalDto,
) {
  return this.financePlanningService.updateSavingsGoal(req.user.userId, id, dto);
}
}