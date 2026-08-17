/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';
import { comparePassword, hashPassword } from './helper.util';
import { generateAvatarUrl } from 'src/common/utils/fileUrl.util';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { MailService } from 'src/mail/mail.service';
import { UcodeRepository } from 'src/common/ucode/ucode.repository';
import { verifyDto } from './dto/verify-email.dto';
import { JwtService } from '@nestjs/jwt';
import { processAndSaveImage } from 'src/common/utils/file-upload.util';
import {
  saveRefreshToken,
  removeRefreshToken,
  validateRefreshToken,
  signAccessToken,
  signRefreshToken,
} from 'src/common/utils/jwt-token.util';

import path from 'path';
import * as fs from 'fs';
import { CompleteProfileDto } from './dto/oauth-register.dto';
import { LoginDto } from './dto/login.dto';
import { parseHeightToMeters } from 'src/common/utils/unit-converter.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ucodeRepository: UcodeRepository,
    private jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) { }

  async checkPhoneExists(phone: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: { phone },
    });
    return {
      success: true,
      message: 'Phone number check completed.',
      exists: !!existingUser,
    };
  }

  async create(registerDto: RegisterDto, image?: Express.Multer.File) {
    const emailToVerify = registerDto.email;

    if (!emailToVerify) {
      console.error('[DEBUG ERROR] Email was missing from registerDto!');
      throw new BadRequestException('Email is required for registration.');
    }

    // 1. Check for existing user conflicts in DB
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: emailToVerify },
          ...(registerDto.phone ? [{ phone: registerDto.phone }] : []),
        ],
      },
    });

    if (existingUser) {
      if (registerDto.phone && existingUser.phone === registerDto.phone) {
        throw new ConflictException('Phone number already exists');
      }
      if (existingUser.email === emailToVerify) {
        throw new ConflictException('Email already exists');
      }
    }

    // 2. Automated Location Query via District Lookup (Optional)
    let lat: number | null = null;
    let lng: number | null = null;

    if (registerDto.district) {
      const districtLookup = await this.prisma.districts.findUnique({
        where: { name: registerDto.district },
      });

      if (!districtLookup) {
        throw new NotFoundException(
          `The district '${registerDto.district}' was not found in our records.`,
        );
      }

      lat = districtLookup.latitude;
      lng = districtLookup.longitude;
    }

    // 3. Handle Image Processing
    let avatarFileName: string | null = null;
    if (image) {
      avatarFileName = await processAndSaveImage(image, 'avatars');
    }

    // 4. Hash Password
    const hashedPassword = await hashPassword(registerDto.password);

    // 5. Store complete temp payload in Redis for 15 minutes (900 seconds)
    const tempUserData = {
      ...registerDto,
      password: hashedPassword,
      avatarUrl: avatarFileName,
      latitude: lat,
      longitude: lng,
    };

    const redisKey = `temp_user:${emailToVerify}`;

    await this.redis.set(
      redisKey,
      JSON.stringify(tempUserData),
      'EX',
      900,
    );

    // Verify key insertion immediately
    const checkRedis = await this.redis.get(redisKey);

    // 6. Generate OTP and send Email via UcodeRepository and MailService
    const otp = await this.ucodeRepository.createOtp(emailToVerify);

    await this.mailService.sendOtpCodeToEmail({
      email: emailToVerify,
      name: registerDto.name,
      otp,
    });

    return {
      success: true,
      message: 'Verification code sent to your email. Please verify to complete registration.',
      email: emailToVerify,
    };
  }

  async verifyEmail(verifydto: verifyDto) {
    try {
      const isValid = await this.ucodeRepository.verifyOtp(
        verifydto.email,
        verifydto.otp,
      );

      if (!isValid) {
        throw new BadRequestException('Invalid or expired OTP');
      }

      const redisKey = `temp_user:${verifydto.email}`;
      const tempUserDataStr = await this.redis.get(redisKey);

      if (!tempUserDataStr) {
        throw new ConflictException('Session expired. Please register again.');
      }

      const tempUserData = JSON.parse(tempUserDataStr);

      const newUser = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: tempUserData.name,
            email: tempUserData.email,
            phone: tempUserData.phone,
            password: tempUserData.password,
            avatarUrl: tempUserData.avatarUrl,
            bio: tempUserData.bio,

            timezone: tempUserData.timezone || 'Asia/Dhaka',
            district: tempUserData.district,
            upazila: tempUserData.upazila,
            latitude: tempUserData.latitude,
            longitude: tempUserData.longitude,

            // Health Metrics
            dateOfBirth: tempUserData.dateOfBirth ? new Date(tempUserData.dateOfBirth) : null,
            gender: tempUserData.gender,
            height: tempUserData.height, // Stores converted meters (e.g., 1.60)
            weight: tempUserData.weight ? parseFloat(tempUserData.weight) : null,
            activityLevel: tempUserData.activityLevel,

            // Feature Toggles
            enableIslamicFeatures: tempUserData.enableIslamicFeatures ?? false,
            enableMailAssistance: tempUserData.enableMailAssistance ?? false,
            enableFinanceTracker: tempUserData.enableFinanceTracker ?? true,
            enableHealthTracking: tempUserData.enableHealthTracking ?? true,
            enableScreenTimeTracking: tempUserData.enableScreenTimeTracking ?? false,
            enableAiBriefings: tempUserData.enableAiBriefings ?? true,

            // Verification & Profile Status
            is_agreed_to_terms_and_policy: tempUserData.is_agreed_to_terms_and_policy,
            isVerified: true,
            isProfileComplete: true,
          },
        });
        return created;
      });

      await this.redis.del(redisKey);

      const finalAvatarUrl = newUser.avatarUrl ? generateAvatarUrl(newUser.avatarUrl) : null;

      return {
        success: true,
        message: 'Email verified successfully. Account created.',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          type: newUser.type,
          phone: newUser.phone,
          avatarUrl: finalAvatarUrl,
        },
      };
    } catch (error: any) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async resendOtp(email: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser)
      throw new ConflictException('Email already verified. Please login.');

    // Get temp data from Redis
    const tempUserDataStr = await this.redis.get(`temp_user:${email}`);
    if (!tempUserDataStr) {
      throw new ConflictException('Session expired. Please register again.');
    }

    const tempUserData = JSON.parse(tempUserDataStr);
    const otp = await this.ucodeRepository.createOtp(email);

    await this.mailService.sendOtpCodeToEmail({
      email,
      name: tempUserData.name || 'User',
      otp,
    });
    return {
      success: true,
      message: 'New OTP sent to your email.',
    };
  }

  async saveRefreshToken(userId: string, refreshToken: string) {
    await saveRefreshToken(this.redis, userId, refreshToken);
  }

  async removeRefreshToken(userId: string) {
    await removeRefreshToken(this.redis, userId);
  }

  async validateRefreshToken(refreshToken: string) {
    return validateRefreshToken(this.redis, this.jwtService, refreshToken);
  }

  async login(logindto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: logindto.email,
      },
    });

    if (!user) throw new BadRequestException('Invalid credentials');

    if (user.status !== 1) {
      throw new ForbiddenException('Your account has been suspended by the admin');
    }

    if (!user.password) throw new BadRequestException('You must provide password');

    const isPasswordValid = await comparePassword(
      logindto.password,
      user.password,
    );
    if (!isPasswordValid) throw new BadRequestException('Invalid credentials');

    // SAVE FIREBASE FCM TOKEN TO ARRAY
    if (logindto.firebaseToken) {
      const tokenExists = user.firebaseToken?.includes(logindto.firebaseToken);

      if (!tokenExists) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            firebaseToken: {
              push: logindto.firebaseToken,
            },
          },
        });
      }
    }

    const finalAvatarUrl = user.avatarUrl ? generateAvatarUrl(user.avatarUrl) : null;

    const payload = {
      sub: user.id,
      name: user.name,
      avatarUrl: finalAvatarUrl,
      district: user.district,
      timzone: user.timezone,
      latitude: user.latitude,
      longitude: user.longitude,
      enableIslamicFeatures: user.enableIslamicFeatures,
      enableMailAssistance: user.enableMailAssistance,
      enableFinanceTracker: user.enableFinanceTracker,
      enableHealthTracking: user.enableHealthTracking,
      enableScreenTimeTracking: user.enableScreenTimeTracking,
      enableAiBriefings: user.enableAiBriefings
    };

    const accessToken = signAccessToken(this.jwtService, payload);
    const refreshToken = signRefreshToken(this.jwtService, payload);

    await this.saveRefreshToken(user.id, refreshToken);

    return {
      success: true,
      message: 'Login successful',
      type: user.type,
      data: {
        accessToken,
        refreshToken,
      },
    };
  }

  async handleGoogleLogin(oauthUser: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: oauthUser.email },
    });

    if (!user) {
      throw new BadRequestException('User registration failed through Google OAuth');
    }

    if (user.status !== 1) {
      throw new ForbiddenException('Your account has been suspended by the admin');
    }

    let shopInfo: {
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
    } | null = null;

    const finalAvatarUrl = user.avatarUrl ? generateAvatarUrl(user.avatarUrl) : null;

    const payload = {
      sub: user.id,
      type: user.type,
      name: user.name,
      avatarUrl: finalAvatarUrl,
      district: user.district,
      latitude: user.latitude,
      longitude: user.longitude,
      shop: shopInfo,
    };

    const accessToken = signAccessToken(this.jwtService, payload);
    const refreshToken = signRefreshToken(this.jwtService, payload);

    await this.saveRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      isProfileComplete: user.isProfileComplete,
    };
  }

  async refreshToken(refreshToken: string) {
    const payload = await this.validateRefreshToken(refreshToken);
    if (!payload || !payload.sub) {
      throw new BadRequestException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) throw new BadRequestException('User not found');

    let shopInfo: {
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
    } | null = null;

    const finalAvatarUrl = user.avatarUrl ? generateAvatarUrl(user.avatarUrl) : null;

    const newPayload = {
      sub: user.id,
      type: user.type,
      name: user.name,
      email: user.email,
      avatarUrl: finalAvatarUrl,
      district: user.district,
      latitude: user.latitude,
      longitude: user.longitude,
      shop: shopInfo,
    };

    const accessToken = signAccessToken(this.jwtService, newPayload);
    const newRefreshToken = signRefreshToken(this.jwtService, newPayload);

    await this.saveRefreshToken(user.id, newRefreshToken);

    return {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          type: user.type,
          avatarUrl: finalAvatarUrl,
          district: user.district,
          latitude: user.latitude,
          longitude: user.longitude,
          shop: shopInfo,
        },
      },
    };
  }

  async revokeRefreshToken(user_id: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);
      if (!storedToken) {
        return {
          success: false,
          message: 'Refresh token not found',
        };
      }

      await this.redis.del(`refresh_token:${user_id}`);

      return {
        success: true,
        message: 'You logged out successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getMe(userId: string) {
    const cacheKey = `user:profile:${userId}`;

    try {
      const cachedProfile = await this.redis.get(cacheKey);
      if (cachedProfile) {
        return {
          success: true,
          message: 'User profile fetched successfully (from cache)',
          data: JSON.parse(cachedProfile),
        };
      }
    } catch (redisError) {
      console.error('Redis error during fetch:', redisError);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, status: 1 },
    });

    if (!user) {
      throw new NotFoundException('User not found or account is inactive');
    }

    const formattedData = {
      ...user,
      avatarUrl: user.avatarUrl ? generateAvatarUrl(user.avatarUrl) : null,
    };

    try {
      await this.redis.set(cacheKey, JSON.stringify(formattedData), 'EX', 25000);
    } catch (redisError) {
      console.error('Redis error during set:', redisError);
    }

    return {
      success: true,
      message: 'User profile fetched successfully',
      data: formattedData,
    };
  }

  async logout(userId: string) {
    return await this.revokeRefreshToken(userId);
  }

  async updateProfile(userId: string, dto: any, file?: Express.Multer.File) {
    const result = await this.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        throw new UnauthorizedException('You have to login or user not found');
      }

      const {
        image,
        dateOfBirth,
        upazila,
        district,
        ...restOfDto
      } = dto;

      const updateData: any = { ...restOfDto };
      const sensitiveFields = [
        'phone',
        'type',
        'status',
        'isVerified',
        'password',
        'firebaseToken',
        'latitude',
        'longitude',
      ];
      sensitiveFields.forEach((field) => {
        delete updateData[field];
      });

      if (upazila && upazila.trim() !== '') updateData.upazila = upazila.trim();
      if (district && district.trim() !== '') updateData.district = district.trim();

      if (dateOfBirth && String(dateOfBirth).trim() !== '') {
        updateData.dateOfBirth = new Date(dateOfBirth);
      }

      if (file) {
        try {
          if (currentUser.avatarUrl) {
            const oldFilename =
              currentUser.avatarUrl.split('/avatars/')[1] ||
              currentUser.avatarUrl.split('avatars-dir-token/')[1] ||
              currentUser.avatarUrl;
            if (oldFilename) {
              const oldFilePath = path.join(
                __dirname,
                '..',
                '..',
                '..',
                '..',
                '..',
                'public',
                'avatars',
                oldFilename,
              );
              if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
                console.log(`Old avatar storage unlinked: ${oldFilename}`);
              }
            }
          }

          const savedFileName = await processAndSaveImage(file, 'avatars');
          updateData.avatarUrl = savedFileName;
        } catch (imageError) {
          console.error('Failed to process incoming update avatar file payload:', imageError);
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      return {
        success: true,
        message: 'Profile and settings updated successfully',
      };
    });

    const cacheKey = `user:profile:${userId}`;
    try {
      await this.redis.del(cacheKey);
      console.log(`[Redis] Cache cleared for key: ${cacheKey} due to profile update.`);
    } catch (redisError) {
      console.error('Redis error during cache deletion:', redisError);
    }

    return result;
  }

  async completeOAuthProfile(userId: string, dto: CompleteProfileDto, image?: Express.Multer.File) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const districtLookup = await this.prisma.districts.findFirst({
      where: { name: dto.district },
    });

    if (!districtLookup) {
      throw new NotFoundException(
        `The district '${dto.district}' was not found in our records.`,
      );
    }

    const lat = districtLookup.latitude ?? dto.latitude ?? null;
    const lng = districtLookup.longitude ?? dto.longitude ?? null;

    let dbAvatarName: string | null = user.avatarUrl;
    if (image) {
      dbAvatarName = await processAndSaveImage(image, 'avatars');
    }

    try {
      const updatedUser = await this.prisma.$transaction(async (tx) => {
        const usr = await tx.user.update({
          where: { id: userId },
          data: {
            district: dto.district,
            latitude: lat,
            longitude: lng,
            bio: dto.bio,
            avatarUrl: dbAvatarName,
            isProfileComplete: true,
          },
        });

        return usr;
      });

      const finalAvatarUrl = updatedUser.avatarUrl ? generateAvatarUrl(updatedUser.avatarUrl) : null;

      const payload = {
        sub: updatedUser.id,
        type: updatedUser.type,
        name: updatedUser.name,
        avatarUrl: finalAvatarUrl,
        district: updatedUser.district,
        latitude: updatedUser.latitude,
        longitude: updatedUser.longitude,
      };

      const accessToken = signAccessToken(this.jwtService, payload);
      const refreshToken = signRefreshToken(this.jwtService, payload);

      await this.saveRefreshToken(updatedUser.id, refreshToken);

      return {
        success: true,
        message: 'Profile completed successfully',
        type: updatedUser.type,
        data: {
          accessToken,
          refreshToken,
        },
      };

    } catch (error: any) {
      throw new BadRequestException(
        error.message || 'Failed to complete profile due to database error'
      );
    }
  }
}