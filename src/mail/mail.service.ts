import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class MailService {
  constructor(
    // Inject the queue we registered in the module
    @InjectQueue('mail_queue') private readonly mailQueue: Queue,
  ) {}

  async sendOtpCodeToEmail(data: { email: string; name: string; otp: string }) {
    try {
      // Add the job to the queue
      await this.mailQueue.add(
        'sendOtp', // Job name
        {
          ...data,
          appName: process.env.APP_NAME || 'EVO',
        },
        {
          attempts: 3, // If SMTP fails, try 3 times
          backoff: {
            type: 'exponential',
            delay: 5000, // Wait 5s, then 10s, etc.
          },
          removeOnComplete: true, // Clean up Redis after success
        },
      );

      return { success: true };
    } catch (error) {
      console.error('Error adding mail to queue:', error);
      throw new InternalServerErrorException(
        'Could not queue the verification email',
      );
    }
  }

  async sendPickupScheduleNotification(data: {
    orderId: string;
    totalPrice: number;
    deliveryAddress: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    farmerName: string;
    farmerEmail: string;
    farmerPhone: string;
    items: Array<{ productName: string; quantity: number; price: number }>;
  }) {
    try {
      await this.mailQueue.add(
        'sendPickupSchedule', // নতুন জব টাইপ
        data,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
        },
      );
      return { success: true };
    } catch (error) {
      console.error('Error adding pickup mail to queue:', error);
      throw new InternalServerErrorException('Could not queue the pickup notification email');
    }
  }

  async sendNewComplainNotification(data: {
  complainantName: string;
  complainantEmail: string;
  complainantPhone: string;
  complainDescription: string;
}) {
  try {
    await this.mailQueue.add(
      'sendNewComplain', // নতুন জব নাম
      data,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
      },
    );
    return { success: true };
  } catch (error) {
    console.error('Error adding complain mail to queue:', error);
    throw new InternalServerErrorException('Could not queue the complain notification email');
  }
}

}
