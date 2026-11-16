import { assert } from './domain-error.js';

/** Value object: a normalised e-mail address. */
export class Email {
  private constructor(readonly value: string) {}

  static of(raw: string): Email {
    const value = raw.trim().toLowerCase();
    assert(value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), 'email.invalid', 'Địa chỉ email không hợp lệ.');
    return new Email(value);
  }

  /** a***@gmail.com: what logs may show. */
  get masked(): string {
    const [local, domain] = this.value.split('@');
    return `${local[0]}***@${domain}`;
  }
}
