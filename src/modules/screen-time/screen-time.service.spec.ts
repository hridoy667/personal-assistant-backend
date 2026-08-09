import { Test, TestingModule } from '@nestjs/testing';
import { ScreenTimeService } from './screen-time.service';

describe('ScreenTimeService', () => {
  let service: ScreenTimeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScreenTimeService],
    }).compile();

    service = module.get<ScreenTimeService>(ScreenTimeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
