/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';

@Processor('mail_queue')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing mail job: ${job.name}`);

    const { email, name, otp } = job.data;
    try {
      if (job.name === 'sendOtp') {
        const { email, name, otp } = job.data;
        await this.mailerService.sendMail({
          to: email,
          subject: 'Email Verification Code',
          template: './email-verification',
          context: { name, otp, appName: 'EVO' },
        });
        this.logger.log(`OTP Email sent to ${email}`);
      }

      else if (job.name === 'sendPickupSchedule') {
        // schedule pickup জব হ্যান্ডলার
        await this.mailerService.sendMail({
          to: 'ali.imamhref@gmail.com', // প্রাপক (Admin)
          subject: `🚨 [Pickup Scheduled] - Order #${job.data.orderId}`,
          template: './pickup-schedule',
          context: {
            ...job.data,
            appName: 'Organic Haat',
          },
        });
        this.logger.log(`Pickup Notification Email sent to ali.imamhref@gmail.com`);
      }

      else if (job.name === 'sendNewComplain') {
        await this.mailerService.sendMail({
          to: 'ali.imamhref@gmail.com', // প্রাপক (Admin)
          subject: `⚠️ [New Complain Filed] - From ${job.data.complainantName}`,
          template: './new-complain',
          context: {
            ...job.data,
            appName: 'Organic Haat',
          },
        });
        this.logger.log(`Complain Notification Email sent to ali.imamhref@gmail.com`);
      }

    } catch (error: any) {
      this.logger.error(`Failed to process job ${job.name}: ${error.message}`);
      throw error;
    }
  }
}
