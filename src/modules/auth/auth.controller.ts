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
  UnauthorizedException,
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
  constructor(private readonly authService: AuthService) { }
  //take phone number from client and check if it exists in database or not, return {exists: true/false} for client side validation
  @Post('check-phone')
  @ApiOperation({ summary: 'Check if phone number exists' })
  checkPhone(@Body() body: { phone: string }) {
    return this.authService.checkPhoneExists(body.phone);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (Waiting Room)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'OTP sent to email.' })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  create(
    @Body() registerDto: RegisterDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.authService.create(registerDto, image);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify OTP and create permanent account' })
  verify(@Body() verifydto: verifyDto) {
    return this.authService.verifyEmail(verifydto);
  }

  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend OTP to email' })
  resendOtp(@Body() resendOtpdto: resendOtpDto) {
    return this.authService.resendOtp(resendOtpdto.email);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  login(@Body() logindto: LoginDto) {
    return this.authService.login(logindto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: any) {
    const userId = req.user.userId;
    return this.authService.getMe(userId);
  }

  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  @Patch('update')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @Req() req: any,
    @Body() dto: UpdateAuthDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    return this.authService.updateProfile(userId, dto, file);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout user' })
  logout(@Request() req) {
    return this.authService.logout(req.user.userId);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: express.Response) {
    const result = await this.authService.handleGoogleLogin(req.user);

    const { accessToken, refreshToken, isProfileComplete } = result;

    const queryParams = `accessToken=${accessToken}&refreshToken=${refreshToken}`;

    if (!isProfileComplete) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/oauth?${queryParams}`);
    } else {
      // 🟢 সরাসরি dashboard এর বদলে auth/callback এ পাঠান
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${queryParams}`);
    }
  }

  @Post('complete-profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Complete OAuth Profile registration' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024, // 8MB limit
      },
    }),
  )
  async completeProfile(
    @Req() req: any,
    @Body() dto: CompleteProfileDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    return this.authService.completeOAuthProfile(userId, dto, image);
  }

}


