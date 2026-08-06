import { Test, TestingModule } from '@nestjs/testing';
import { DashbordController } from './dashbord.controller';
import { DashboardService } from './dashboard.service';

describe('DashbordController', () => {
  let controller: DashbordController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashbordController],
      providers: [DashboardService],
    }).compile();

    controller = module.get<DashbordController>(DashbordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
