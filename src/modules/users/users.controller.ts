/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  Patch,
  Body,
} from '@nestjs/common';
import { UsersService } from './users.service';
// import { CreateUserDto } from './dto/create-user.dto';
// import { UpdateUserDto } from './dto/update-user.dto';
import { ApiOperation } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateSettingDto } from '../settings/dto/update-setting.dto';
import { UpdateSettingsDto } from './dto/updateSettingsDto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // @Post()
  // create(@Body() createUserDto: CreateUserDto) {
  //   return this.usersService.create(createUserDto);
  // }

  @Get()
  @ApiOperation({ summary: 'Get all users with cursor pagination' })
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  /** Must be registered before @Get(':id') or "user-profile" is captured as an id. */
  @Get('user-profile')
  @UseGuards(JwtAuthGuard)
  getUserProfile(@Req() req: any) {
    return this.usersService.getUserProfile(req.user.userId);
  }

  @Get('profile/:userId')
  @UseGuards(JwtAuthGuard)
  getUserProfileById(@Req() req: any, @Param('userId') userId: string) {
    return this.usersService.getUserProfileForViewer(req.user.userId, userId);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  async userSettings(@Req() req: any){
    const userId=req.user.userId
    return this.usersService.settings(userId)
  }

  @Patch('update/settings')
  @UseGuards(JwtAuthGuard)
  async userSettingsUpdate(@Req() req: any,@Body() dto:UpdateSettingsDto){
    const userId=req.user.userId
    return this.usersService.settingsUpdate(userId,dto)
  }

}
