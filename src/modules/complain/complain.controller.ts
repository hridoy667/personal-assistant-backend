import { Controller, Post, Get, Body, Req, UseGuards, Param, NotFoundException, Query, Patch, Delete } from '@nestjs/common';
import { ComplainService } from './complain.service';
import { CreateComplainDto } from './dto/create-complain.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { UpdateComplainDto } from './dto/update-complain.dto';

@UseGuards(JwtAuthGuard)
@Controller('complains')
export class ComplainController {
  constructor(private readonly complainService: ComplainService) { }

  @Post()
  async createComplain(@Body() createComplainDto: CreateComplainDto, @Req() req: any) {
    // Securely pull the user context from your JwtAuthGuard
    const userId = req.user.userId;
    return this.complainService.create(userId, createComplainDto);
  }

  @Get()
  async getMyComplains(
    @Req() req: any,
    @Query() paginationDto: PaginationDto
  ) {
    const userId = req.user.userId;
    return this.complainService.findAllByUser(userId, paginationDto);
  }

  @Get(':id')
  async getComplainById(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.complainService.findOne(id, userId);
  }

  @Patch(':id')
  async updateComplain(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateComplainDto: UpdateComplainDto,
  ) {
    const userId = req.user.userId;
    return this.complainService.updateComplain(id, userId, updateComplainDto);
  }

  @Delete(':id')
  async deleteComplain(@Param('id') id: string,
    @Req() req: any) {
    const userId = req.user.userId;
    return this.complainService.deleteComplain(id, userId);
  }
}