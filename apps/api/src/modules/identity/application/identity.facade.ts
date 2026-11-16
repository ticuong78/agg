import { Injectable } from '@nestjs/common';
import { UserRepository } from '../domain/repositories.js';

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  referralCode: string;
  marketingConsent: boolean;
}

/** What other contexts may know about accounts. */
@Injectable()
export class IdentityFacade {
  constructor(private readonly users: UserRepository) {}

  async find(id: string): Promise<UserSummary | null> {
    const user = await this.users.findById(id);
    return user ? summary(user.snapshot()) : null;
  }

  async findByEmail(email: string): Promise<UserSummary | null> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    return user ? summary(user.snapshot()) : null;
  }

  async findMany(ids: string[]): Promise<UserSummary[]> {
    if (!ids.length) return [];
    return (await this.users.findManyByIds(ids)).map((u) => summary(u.snapshot()));
  }
}

const summary = (s: { id: string; email: string; name: string; referralCode: string; marketingConsent: boolean }): UserSummary => ({
  id: s.id, email: s.email, name: s.name, referralCode: s.referralCode, marketingConsent: s.marketingConsent,
});
