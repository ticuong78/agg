import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { Mailer, type MailMessage } from '../application/mailer.js';

/** SMTP when SMTP_HOST is set; otherwise (development) the message is written to the log. */
@Injectable()
export class SmtpMailer extends Mailer {
  private readonly logger = new Logger(SmtpMailer.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    super();
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('MAIL_FROM') || 'GoiDe <no-reply@localhost>';
    this.transport = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get('SMTP_PORT') ?? 587),
          secure: config.get('SMTP_SECURE') === 'true',
          auth: config.get('SMTP_USER') ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASSWORD') } : undefined,
        })
      : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transport) {
      this.logger.log(`[dev mail] to=${message.to} subject="${message.subject}"\n${message.text}`);
      return;
    }
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
