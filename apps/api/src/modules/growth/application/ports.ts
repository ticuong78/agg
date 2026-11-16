/** Port (ACL) towards Billing: rewards become credits. Idempotent on `reference`. */
export abstract class CreditGranter {
  abstract grant(userId: string, credits: number, reference: string, reason: string): Promise<boolean>;
}

/** Port (ACL) towards Identity. */
export abstract class GrowthIdentityPort {
  abstract find(userId: string): Promise<{ id: string; email: string; name: string; referralCode: string; marketingConsent: boolean } | null>;
  abstract findMany(userIds: string[]): Promise<{ id: string; email: string }[]>;
}
