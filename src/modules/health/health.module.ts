import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { DashbordModule } from '../dashbord/dashbord.module';
@Module({
  imports:[DashbordModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
