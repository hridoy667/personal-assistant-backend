import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service'; // Ensure this path is correct

@Injectable()
export class UcodeRepository {
  // Inject your existing PrismaService instead of "new PrismaClient()"
  constructor(private readonly prisma: PrismaService) {}

  async createOtp(email: string): Promise<string> {
    const token = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await this.prisma.verificationToken.upsert({
      where: { email },
      update: { token, expiresAt },
      create: { email, token, expiresAt },
    });

    return token;
  }

  async verifyOtp(email: string, token: string): Promise<boolean> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { email },
    });

    if (!record) throw new BadRequestException('Invalid or expired code');

    if (new Date() > record.expiresAt) {
      await this.prisma.verificationToken.delete({ where: { email } });
      throw new BadRequestException('Code has expired');
    }

    if (record.token !== token) {
      throw new BadRequestException('Invalid code');
    }

    await this.prisma.verificationToken.delete({ where: { email } });
    return true;
  }
}
