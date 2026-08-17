import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service'; // Ensure this path is correct

@Injectable()
export class UcodeRepository {
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

  async generateAndSaveOtp(email: string): Promise<string> {
    return this.createOtp(email);
  }

  // ucode.repository.ts
async verifyOtp(email: string, token: string): Promise<boolean> {
  const record = await this.prisma.verificationToken.findUnique({
    where: { email },
  });

  if (!record) {
    throw new BadRequestException('Invalid or expired code');
  }

  if (new Date() > record.expiresAt) {
    await this.prisma.verificationToken.delete({ where: { email } });
    throw new BadRequestException('Code has expired');
  }

  // Ensure string types and trim whitespace
  const storedToken = String(record.token).trim();
  const inputToken = String(token).trim();

  if (storedToken !== inputToken) {
    throw new BadRequestException('Invalid code');
  }

  await this.prisma.verificationToken.delete({ where: { email } });
  return true;
}
}