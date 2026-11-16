import { Injectable, Logger } from '@nestjs/common';
import type { AuthResponse, MeDto, UpdateProfileRequest, VerifyCodeRequest } from '@agg/contracts';
import { randomInt } from 'node:crypto';
import { EventPublisher } from '../../../shared/application/event-publisher.js';
import { Mailer } from '../../../shared/application/mailer.js';
import { RateLimiter } from '../../../shared/application/rate-limiter.js';
import type { UserRequester } from '../../../shared/application/requester.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { Email } from '../../../shared/domain/email.js';
import { enforceRateLimit } from '../../../shared/application/rate-limit.js';
import { CODE_TTL_MINUTES, SignInCode } from '../domain/sign-in-code.js';
import { SignInCodeRepository, UserRepository } from '../domain/repositories.js';
import { User } from '../domain/user.js';
import { AccountDeleted } from '../identity.events.js';
import { AdminDirectory, CodeHasher, TokenService } from './ports.js';

/** Passwordless sign-in: an address gets a six-digit code; the first successful code creates the account. */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly codes: SignInCodeRepository,
    private readonly hasher: CodeHasher,
    private readonly tokens: TokenService,
    private readonly admins: AdminDirectory,
    private readonly mailer: Mailer,
    private readonly limiter: RateLimiter,
    private readonly events: EventPublisher,
  ) {}

  async requestCode(rawEmail: string, ipHash: string): Promise<void> {
    const email = Email.of(rawEmail);
    await enforceRateLimit(this.limiter, `code:ip:${ipHash}`, 10, 3600);
    await enforceRateLimit(this.limiter, `code:email:${email.value}`, 3, 600);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.codes.save(SignInCode.issue(email.value, this.hasher.hash(email.value, code)));
    await this.mailer.send({
      to: email.value,
      subject: `Mã đăng nhập của bạn: ${code}`,
      text: `Mã đăng nhập: ${code}\n\nMã có hiệu lực trong ${CODE_TTL_MINUTES} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    });
    this.logger.log(`Sign-in code sent to ${email.masked}`);
  }

  async verifyCode(body: VerifyCodeRequest, visitorId: string | null, ipHash: string): Promise<AuthResponse> {
    const email = Email.of(body.email);
    await enforceRateLimit(this.limiter, `verify:ip:${ipHash}`, 30, 3600);
    const code = await this.codes.find(email.value);
    if (!code) throw DomainError.validation('auth.code_expired', 'Mã đã hết hạn. Hãy yêu cầu mã mới.');
    try {
      code.verify((hash) => this.hasher.matches(email.value, body.code.trim(), hash));
    } finally {
      await this.codes.save(code);
    }
    await this.codes.delete(email.value);

    const role = this.admins.isAdmin(email.value) ? 'ADMIN' : 'USER';
    let user = await this.users.findByEmail(email.value);
    if (user) {
      user.signedIn(role);
    } else {
      const referrer = body.referralCode ? await this.users.findByReferralCode(body.referralCode.trim().toUpperCase()) : null;
      user = User.register({
        email, name: body.name, role, referredByUserId: referrer?.id ?? null,
        marketingConsent: body.marketingConsent === true, visitorId,
      });
    }
    await this.users.save(user);
    await this.events.publish(user.pullEvents());
    const token = await this.tokens.issue({ sub: user.id, email: user.email, role: user.role });
    return { token, user: toMe(user) };
  }

  async me(requester: UserRequester): Promise<MeDto> {
    return toMe(await this.load(requester.userId));
  }

  async updateProfile(requester: UserRequester, body: UpdateProfileRequest): Promise<MeDto> {
    const user = await this.load(requester.userId);
    user.updateProfile(body);
    await this.users.save(user);
    return toMe(user);
  }

  /** Right to erasure: the account goes, and every context deletes what it holds (see the AccountDeleted handlers). */
  async deleteAccount(requester: UserRequester): Promise<void> {
    const user = await this.load(requester.userId);
    await this.events.publish([new AccountDeleted(user.id, user.email)]);
    await this.codes.delete(user.email);
    await this.users.delete(user.id);
    this.logger.log(`Account deleted on request (${Email.of(user.email).masked})`);
  }

  private async load(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw DomainError.unauthorized('auth.required', 'Phiên đăng nhập không còn hiệu lực.');
    return user;
  }
}

export function toMe(user: User): MeDto {
  return { id: user.id, email: user.email, name: user.name, role: user.role, referralCode: user.referralCode, marketingConsent: user.marketingConsent };
}
