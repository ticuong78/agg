export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Port: sends one e-mail. Without SMTP configured, development writes it to the log. */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}
