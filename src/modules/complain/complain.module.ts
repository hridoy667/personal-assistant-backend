import { Module } from '@nestjs/common';
import { ComplainService } from './complain.service';
import { ComplainController } from './complain.controller';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports:[MailModule],
  controllers: [ComplainController],
  providers: [ComplainService],
})
export class ComplainModule {}
