// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { MailService } from './mail.service'; // Adjust path as needed

@Controller()
export class AppController {
  constructor(private readonly mailService: MailService) {}

  @Get('test-mail')
  async testMail() {
    await this.mailService.sendOtpCodeToEmail({
      name: 'Developer',
      email: 'your-personal-email@gmail.com', // Put your real email here!
      otp: '123456',
    });
    return { message: 'Check your inbox!' };
  }
}
