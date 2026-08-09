import { Test, TestingModule } from '@nestjs/testing';
import { FinancePlanningController } from './finance-planning.controller';
import { FinancePlanningService } from './finance-planning.service';

describe('FinancePlanningController', () => {
  let controller: FinancePlanningController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancePlanningController],
      providers: [FinancePlanningService],
    }).compile();

    controller = module.get<FinancePlanningController>(FinancePlanningController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
