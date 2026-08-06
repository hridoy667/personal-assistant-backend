import { Controller, Post, Body, BadRequestException, Get, Req, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

 @Post('send')
  async sendNotification(@Body() sendNotificationDto: SendNotificationDto) {
    const { userIds, title, body } = sendNotificationDto;
    if (Array.isArray(userIds) && userIds.length === 0) {
      throw new BadRequestException('userIds array cannot be empty');
    }
    return await this.notificationService.sendNotificationToUsers(userIds, title, body);
  }

  @Get()
  async getAllNotifications(@Req() req: any, @Query() paginationDto: PaginationDto) {
    const userId = req.user.id;
    return this.notificationService.getAll(userId, paginationDto);
  }

  @Delete(':id')
  async deleteOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.notificationService.deleteOne(id, userId);
  }

}