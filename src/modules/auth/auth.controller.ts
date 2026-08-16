/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  Req,
  Get,
  Patch,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { verifyDto } from './dto/verify-email.dto';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { resendOtpDto } from './dto/resend-otp.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import * as express from 'express';
import { CompleteProfileDto } from './dto/oauth-register.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('check-phone')
  @ApiOperation({ summary: 'Check if phone number exists' })
  async checkPhone(@Body() body: { phone: string }) {
    return await this.authService.checkPhoneExists(body.phone);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (Temporary Waiting Room)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'OTP code sent to email.' })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  async create(
    @Body() registerDto: RegisterDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return await this.authService.create(registerDto, image);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify OTP and create permanent account' })
  async verify(@Body() verifydto: verifyDto) {
    return await this.authService.verifyEmail(verifydto);
  }

  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend OTP code to email' })
  async resendOtp(@Body() resendOtpdto: resendOtpDto) {
    return await this.authService.resendOtp(resendOtpdto.email);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  async login(@Body() logindto: LoginDto) {
    return await this.authService.login(logindto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() body: RefreshTokenDto) {
    return await this.authService.refreshToken(body.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Req() req: any) {
    const userId = req.user.userId;
    return await this.authService.getMe(userId);
  }

  @Patch('update')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update user profile & modular settings' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  async updateProfile(
    @Req() req: any,
    @Body() dto: UpdateAuthDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    return await this.authService.updateProfile(userId, dto, file);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Request() req: any) {
    return await this.authService.logout(req.user.userId);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: any) {
    // Guard initiates Google OAuth redirect
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: express.Response) {
    const result = await this.authService.handleGoogleLogin(req.user);

    const { accessToken, refreshToken, isProfileComplete } = result;

    const queryParams = `accessToken=${accessToken}&refreshToken=${refreshToken}`;

    if (!isProfileComplete) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/oauth?${queryParams}`);
    } else {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${queryParams}`);
    }
  }

  @Post('complete-profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Complete OAuth Profile registration' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  async completeProfile(
    @Req() req: any,
    @Body() dto: CompleteProfileDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    return await this.authService.completeOAuthProfile(userId, dto, image);
  }
}