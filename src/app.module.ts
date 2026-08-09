import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '@nestjs-modules/ioredis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/app.config'; // Your custom config file
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DistrictsModule } from './modules/districts/districts.module';
import { DashbordModule } from './modules/dashbord/dashbord.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ComplainModule } from './modules/complain/complain.module';
import { LegalModule } from './modules/legal/legal.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TasksModule } from './modules/tasks/tasks.module';
import { HabitsModule } from './modules/habits/habits.module';
import { MoodModule } from './modules/mood/mood.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { SkillsModule } from './modules/skills/skills.module';
import { JournalModule } from './modules/journal/journal.module';
import { RoutinesModule } from './modules/routines/routines.module';
import { FinancePlanningModule } from './modules/finance-planning/finance-planning.module';
import { HealthModule } from './modules/health/health.module';
import { ScreenTimeModule } from './modules/screen-time/screen-time.module';
import { GmailModule } from './modules/gmail/gmail.module';

@Module({
  imports: [
    // ১. গ্লোবাল কনফিগারেশন মডিউল
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),

    ScheduleModule.forRoot(), 
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 5,
    }]),
    AuthModule,
    DistrictsModule,
    UsersModule,
    
    // BullMQ কনফিগারেশন
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('redis.host'),
          port: +config.get('redis.port'),
          password: config.get('redis.password'),
        },
      }),
    }),

    // Register the specific mail queue
    BullModule.registerQueue({
      name: 'mail_queue',
    }),

    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: `redis://${config.get('redis.host')}:${config.get('redis.port')}`,
        options: {
          password: config.get('redis.password'),
        },
      }),
    }),

    DashbordModule,
    NotificationModule,
    ComplainModule,
    LegalModule,
    TasksModule,
    HabitsModule,
    MoodModule,
    TransactionsModule,
    SkillsModule,
    JournalModule,
    RoutinesModule,
    FinancePlanningModule,
    HealthModule,
    ScreenTimeModule,
    GmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}