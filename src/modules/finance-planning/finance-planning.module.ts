import { Module } from '@nestjs/common';
import { FinancePlanningService } from './finance-planning.service';
import { FinancePlanningController } from './finance-planning.controller';

@Module({
  controllers: [FinancePlanningController],
  providers: [FinancePlanningService],
})
export class FinancePlanningModule {}
