/** Port (anti-corruption layer) towards Identity: the few account facts Billing needs. */
export abstract class BillingIdentityPort {
  abstract find(userId: string): Promise<{ id: string; email: string; name: string } | null>;
  abstract findMany(userIds: string[]): Promise<{ id: string; email: string }[]>;
}
