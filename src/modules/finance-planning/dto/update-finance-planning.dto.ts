import { PartialType } from '@nestjs/swagger';
import { CreateBudgetDto, CreateSavingsGoalDto } from './finance-planning.dto';

export class UpdateBudgetDto extends PartialType(CreateBudgetDto) {}

export class UpdateSavingsGoalDto extends PartialType(CreateSavingsGoalDto) {}