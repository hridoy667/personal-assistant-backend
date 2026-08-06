import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapterPlain } from './handlebars-adapter-plain';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { join } from 'path';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'mail_queue',
    }),

    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get('mail.host'),
          port: config.get('mail.port'),
          secure: config.get('mail.port') === 465,
          auth: {
            user: config.get('mail.user'),
            pass: config.get('mail.password'),
          },
        },
        defaults: {
          from: `"${config.get('app.name')}" <${config.get('mail.from')}>`,
        },
        template: {
          // Replace join(__dirname, 'templates') with this:
          dir: join(process.cwd(), 'dist/mail/templates'),
          adapter: new HandlebarsAdapterPlain(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
