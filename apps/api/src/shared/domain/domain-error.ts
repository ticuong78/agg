export type DomainErrorKind =
  | 'validation' | 'not_found' | 'forbidden' | 'conflict' | 'unauthorized' | 'rate_limited' | 'payment_required';

/**
 * Errors raised by domain/application code. They carry no HTTP knowledge;
 * the presentation layer maps `kind` to a status code.
 */
export class DomainError extends Error {
  constructor(
    readonly kind: DomainErrorKind,
    readonly code: string,
    message: string,
    /** Extra data for the client (what to upgrade to, when to retry...). */
    readonly details?: Record<string, string>,
  ) {
    super(message);
  }

  static validation(code: string, message: string) {
    return new DomainError('validation', code, message);
  }
  static notFound(code: string, message: string) {
    return new DomainError('not_found', code, message);
  }
  static forbidden(code: string, message: string, details?: Record<string, string>) {
    return new DomainError('forbidden', code, message, details);
  }
  static conflict(code: string, message: string) {
    return new DomainError('conflict', code, message);
  }
  static unauthorized(code: string, message: string) {
    return new DomainError('unauthorized', code, message);
  }
  /** Not enough credits / quota: the client offers sign-in, a plan or a top-up. */
  static paymentRequired(code: string, message: string, details?: Record<string, string>) {
    return new DomainError('payment_required', code, message, details);
  }
  static rateLimited(code: string, message: string, retryAfterSeconds: number) {
    return new DomainError('rate_limited', code, message, { retryAfterSeconds: String(Math.max(1, Math.ceil(retryAfterSeconds))) });
  }
}

export function assert(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw DomainError.validation(code, message);
}
