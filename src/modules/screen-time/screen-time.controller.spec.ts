import { Test, TestingModule } from '@nestjs/testing';
import { ScreenTimeController } from './screen-time.controller';
import { ScreenTimeService } from './screen-time.service';

describe('ScreenTimeController', () => {
  let controller: ScreenTimeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScreenTimeController],
      providers: [ScreenTimeService],
    }).compile();

    controller = module.get<ScreenTimeController>(ScreenTimeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
