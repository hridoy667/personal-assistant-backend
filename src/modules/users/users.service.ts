/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
// import { CreateUserDto } from './dto/create-user.dto';
// import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { UpdateAuthDto } from '../auth/dto/update-auth.dto';
import path from 'path';
import { generateAvatarUrl } from 'src/common/utils/fileUrl.util';
import { UpdateSettingDto } from '../settings/dto/update-setting.dto';
import { UpdateSettingsDto } from './dto/updateSettingsDto';
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  // create(createUserDto: CreateUserDto) {
  //   return 'This action adds a new user';
  // }

  async findAll(pagination: PaginationDto) {
    const { cursor, limit } = pagination;
    const take = Number(limit);

    const users = await this.prisma.user.findMany({
      take: take,
      ...(cursor && {
        skip: 1, // Skip the cursor itself
        cursor: { id: cursor },
      }),
      orderBy: {
        createdAt: 'asc', // Or 'desc' depending on your preference
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    });

    // Calculate the next cursor
    const nextCursor =
      users.length === take ? users[users.length - 1].id : null;

    return {
      data: users,
      meta: {
        nextCursor,
      },
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  // update(id: number, updateUserDto: UpdateUserDto) {
  //   return `This action updates a #${id} user`;
  // }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        userName: true,
        district: true,
        upazila: true,
        avatarUrl: true,
        bio: true,
        dateOfBirth: true,
        isVerified: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    return {
      success: true,
      data: {
        ...user,
      },
    };
  }

  /** Same posts payload as own profile; omits email when the viewer is not that user. */
  async getUserProfileForViewer(viewerId: string, targetUserId: string) {
    const { success, data } = await this.getUserProfile(targetUserId);
    if (viewerId === targetUserId) {
      return { success, data };
    }
    const { email: _omit, ...publicData } = data;
    return { success, data: publicData };
  }

  async settings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        name: true,
        isVerified: true,
        email: true,
        phone: true,
        avatarUrl: true,
        type: true,
        createdAt: true,
        isNotificationOn: true,
        securityAlert: true,
        emailNotification: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 🟢 ২. এভাটার ইউআরএল জেনারেট করা
    const avatarUrl = user.avatarUrl ? generateAvatarUrl(user.avatarUrl) : null;

    // 🟢 ৩. ক্লিন উপায়ে ডাটা রিটার্ন করা এবং ফ্ল্যাগগুলো যুক্ত করা
    return {
      success: true,
      data: {
        ...user,
        avatarUrl,
        emailAdded: !!user.email, // ইমেইল থাকলে true, না থাকলে false
        phoneAdded: !!user.phone, // ফোন থাকলে true, না থাকলে false
      },
    };
  }

  async settingsUpdate(userId: string, dto: UpdateSettingsDto = {}) {

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.isNotificationOn !== undefined && { isNotificationOn: dto.isNotificationOn }),
        ...(dto.securityAlert !== undefined && { securityAlert: dto.securityAlert }),
        ...(dto.emailNotification !== undefined && { emailNotification: dto.emailNotification }),
      },
      select: {
        id: true,
        isNotificationOn: true,
        securityAlert: true,
        emailNotification: true,
      },
    });

    return {
      success: true,
      message: 'Settings updated successfully',
      data: updatedUser,
    };
  }

}
