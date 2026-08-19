import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DashboardService } from './dashboard.service';
import { DashbordController } from './dashbord.controller';

@Module({
  imports: [HttpModule],
  controllers: [DashbordController],
  providers: [DashboardService],
  exports:[DashboardService]
})
export class DashbordModule {}
