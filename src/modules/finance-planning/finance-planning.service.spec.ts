import { Test, TestingModule } from '@nestjs/testing';
import { FinancePlanningService } from './finance-planning.service';

describe('FinancePlanningService', () => {
  let service: FinancePlanningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinancePlanningService],
    }).compile();

    service = module.get<FinancePlanningService>(FinancePlanningService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
