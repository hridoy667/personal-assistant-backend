import { Module } from '@nestjs/common';
import { ScreenTimeService } from './screen-time.service';
import { ScreenTimeController } from './screen-time.controller';

@Module({
  controllers: [ScreenTimeController],
  providers: [ScreenTimeService],
})
export class ScreenTimeModule {}
