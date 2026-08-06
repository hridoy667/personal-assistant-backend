import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
  }

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        this.logger.log('✅ Database connected');
        return;
      } catch (e) {
        retries--;
        this.logger.warn(
          `⚠️ DB connection failed, retrying in 5s... (${retries} retries left)`,
        );
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
    this.logger.error('❌ Could not connect to database after 5 retries');
  }
}