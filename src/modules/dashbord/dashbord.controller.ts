/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashbordController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async dashboard(@Req() req: any) {
    const userId = req.user.userId;
    return this.dashboardService.dashboard(userId);
  }

  @Get('weather')
  async getWeather(@Req() req: any) {
    const userId = req.user?.userId;
    return this.dashboardService.getWeatherByPlace(userId);
  }
}
