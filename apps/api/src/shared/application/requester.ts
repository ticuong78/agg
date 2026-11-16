import type { Role } from '@agg/contracts';

/** A signed-in account. */
export interface UserRequester {
  kind: 'user';
  userId: string;
  email: string;
  role: Role;
  visitorId: string | null;
  ipHash: string;
}

/** Someone who has not signed in: known by the visitor id their browser keeps, and their (hashed) address. */
export interface GuestRequester {
  kind: 'guest';
  visitorId: string | null;
  ipHash: string;
}

/** Who performs a use case. Every request has one; guards decide which kinds a route accepts. */
export type Requester = UserRequester | GuestRequester;

export const isUser = (r: Requester): r is UserRequester => r.kind === 'user';
export const isAdmin = (r: Requester): boolean => isUser(r) && r.role === 'ADMIN';
