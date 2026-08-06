import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class AppService implements OnModuleInit {
  // 1. You MUST inject the Redis client here
  constructor(@InjectRedis() private readonly redis: Redis) {}

  getHello(): string {
    return 'Hello World!';
  }

  // 2. This runs automatically when the app starts
  async onModuleInit() {
    try {
      await this.redis.set('nest_test', 'Redis is Alive!');
      const val = await this.redis.get('nest_test');
      console.log('🚀 Redis Connection Test:', val);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.error('❌ Redis Connection Failed:', err.message);
    }
  }
}
