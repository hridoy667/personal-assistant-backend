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
import { RegisterDto, UserRole } from './dto/register.dto';
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
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ucodeRepository: UcodeRepository,
    private jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) { }

  async checkPhoneExists(phone) {
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
    // 1. Check for existing conflicts
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: registerDto.email }, { phone: registerDto.phone }],
      },
    });

    if (existingUser) {
      if (existingUser.phone === registerDto.phone)
        throw new ConflictException('Phone number already exists');
      if (existingUser.email === registerDto.email)
        throw new ConflictException('Email already exists');
    }

    // 2. Automated Location Query via District Table Lookups
    const districtLookup = await this.prisma.districts.findUnique({
      where: { name: registerDto.district },
    });

    if (!districtLookup) {
      throw new NotFoundException(
        `The district '${registerDto.district}' was not found in our records.`,
      );
    }

    const lat = districtLookup.latitude;
    const lng = districtLookup.longitude;

    // 3. Handle Image Processing using your utility
    let avatarUrl: string | null = null;
    if (image) {
      const savedFileName = await processAndSaveImage(image, 'avatars');
      avatarUrl = generateAvatarUrl(savedFileName);
    }

    // 4. Hash Password
    const hashedPassword = await hashPassword(registerDto.password);

    // 5. Save directly using an Atomic Transaction
    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: registerDto.email,
          name: registerDto.name,
          phone: registerDto.phone,
          password: hashedPassword,
          avatarUrl: avatarUrl,
          district: registerDto.district,
          latitude: lat,
          longitude: lng,
          address: registerDto.location,
          is_agreed_to_terms_and_policy: registerDto.is_agreed_to_terms_and_policy,
          isVerified: true,
        },
      });

      if (user) {
        await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            isProfileComplete: true,
          }
        })
      }

      return user;
    });

    // 6. Clean Return
    return {
      success: true,
      message: 'Account created successfully.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        type: newUser.type,
        phone: newUser.phone,
      },
    };
  }

  async verifyEmail(verifydto: verifyDto) {
    try {
      // Verify OTP
      const isValid = await this.ucodeRepository.verifyOtp(
        verifydto.email,
        verifydto.otp,
      );

      if (!isValid) {
        throw new BadRequestException('Invalid or expired OTP');
      }

      // Get temp data from Redis
      const tempUserDataStr = await this.redis.get(
        `temp_user:${verifydto.email}`,
      );
      if (!tempUserDataStr) {
        throw new ConflictException('Session expired. Please register again.');
      }

      const tempUserData = JSON.parse(tempUserDataStr);

      // Create user in DB
      const newUser = await this.prisma.user.create({
        data: {
          email: tempUserData.email,
          name: tempUserData.name,
          password: tempUserData.password,
          avatarUrl: tempUserData.avatarUrl,
          district: tempUserData.district,
        },
      });

      // Remove data from Redis so it can't be used again
      await this.redis.del(`temp_user:${verifydto.email}`);

      // 5. RETURN success
      return {
        success: true,
        message: 'Email verified successfully. Account created.',
        user: {
          id: newUser.id,
          email: newUser.email,
        },
      };
    } catch (error: any) {
      // Rethrow if it's already a NestJS exception, otherwise wrap it
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async resendOtp(email) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser)
      throw new ConflictException('Email already verified. Please login.');

    //Get temp data from Redis
    const tempUserDataStr = await this.redis.get(`temp_user:${email}`);
    if (!tempUserDataStr) {
      throw new ConflictException('Session expired. Please register again.');
    }

    const tempUserData = JSON.parse(tempUserDataStr);
    const otp = await this.ucodeRepository.createOtp(email);

    await this.mailService.sendOtpCodeToEmail({
      email,
      name: tempUserData.name,
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

    // SAVE FIREBASE FCM TOKEN TO ARRAY ──
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

    // Fetch shop info for farmers before creating tokens
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

    // Fetch shop info for farmers before creating tokens
    let shopInfo: {
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
    } | null = null;

    const newPayload = {
      sub: user.id,
      type: user.type,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
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
          avatarUrl: user.avatarUrl,
          district: user.district,
          latitude: user.latitude,
          longitude: user.longitude,
          shop: shopInfo,
        },
      },
    };
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

    const userRoleCheck = await this.prisma.user.findUnique({
      where: { id: userId, status: 1 },
      select: {
        type: true,
      },
    });

    if (!userRoleCheck) {
      throw new NotFoundException('User not found or account is inactive');
    }

    let formattedData: any = null;

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

  async updateProfile(userId: string, dto: any, file?: Express.Multer.File) {
    const result = await this.prisma.$transaction(async (tx) => {

      const currentUser = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        throw new UnauthorizedException('You have to login or user not found');
      }

      const {
        farmTypes,
        image,
        shopName,
        shopDescription,
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
              currentUser.avatarUrl.split('avatars-dir-token/')[1];
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
          updateData.avatarUrl = generateAvatarUrl(savedFileName);
        } catch (imageError) {
          console.error('Failed to process incoming update avatar file payload:', imageError);
        }
      }

      return {
        success: true,
        message: 'Profile and shop settings updated successfully',
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
  // ১. ইউজার এক্সিস্টেন্স চেক
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new BadRequestException('User not found');
  }

  // ২. ডিস্ট্রিক্ট লুকআপ
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

  // 🟢 ৩. ইমেজ প্রসেসিং: ডাটাবেজের জন্য শুধু ফাইলনেম (savedFileName) স্টোর করব
  let dbAvatarName: string | null = user.avatarUrl; 
  if (image) {
    dbAvatarName = await processAndSaveImage(image, 'avatars'); // e.g., '1784232361840-customericon2.webp'
  }

  try {
    // ৪. ডাটাবেজ ট্রানজেকশন
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const usr = await tx.user.update({
        where: { id: userId },
        data: {
          district: dto.district,
          latitude: lat,
          longitude: lng,
          address: dto.location,
          bio: dto.bio,
          shippingAddress: dto.shippingAddress,
          avatarUrl: dbAvatarName, // 🟢 ডাটাবেজে যাচ্ছে শুধু ফাইলনেম
          isProfileComplete: true,
        },
      });

      // ফারমার হলে ডিপেন্ডেন্ট রেকর্ড তৈরি
      if (dto.type === 'FARMER') {
        if (!dto.shopName) {
          throw new BadRequestException('Shop name is required for farmers');
        }
      }

      return usr;
    });


    // 🟢 ৬. পেলোড তৈরির সময় ফাইলনেমকে ফুল URL-এ কনভার্ট করা
    const finalAvatarUrl = updatedUser.avatarUrl ? generateAvatarUrl(updatedUser.avatarUrl) : null;

    // ৭. JWT পেলোড ও টোকেন জেনারেট
    const payload = {
      sub: updatedUser.id,
      type: updatedUser.type,
      name: updatedUser.name, 
      avatarUrl: finalAvatarUrl, // 🟢 পেলোডে যাচ্ছে জেনারেটেড ফুল URL
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
