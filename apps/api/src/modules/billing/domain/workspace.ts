import type { WorkspaceRole } from '@agg/contracts';
import { newId } from '../../../shared/domain/aggregate-root.js';
import { assert, DomainError } from '../../../shared/domain/domain-error.js';
import { Email } from '../../../shared/domain/email.js';

export interface WorkspaceMember {
  email: string;
  userId: string | null;
  role: WorkspaceRole;
  invitedAt: Date;
  joinedAt: Date | null;
}

export interface WorkspaceState {
  id: string;
  name: string;
  ownerUserId: string;
  /** Printed on top of exported statements ("Trường THPT ... — Tổ Tin học"). */
  header: string;
  members: WorkspaceMember[];
}

/**
 * Aggregate: a school team sharing one credit pool. Members are invited by e-mail and join when they sign in
 * with that address. The seat limit comes from the workspace's plan.
 */
export class Workspace {
  private constructor(private state: WorkspaceState) {}

  static create(name: string, owner: { userId: string; email: string }, now = new Date()): Workspace {
    const workspace = new Workspace({ id: newId(), name: '', ownerUserId: owner.userId, header: '', members: [] });
    workspace.rename(name || 'Tổ chuyên môn');
    workspace.state.members.push({ email: owner.email, userId: owner.userId, role: 'OWNER', invitedAt: now, joinedAt: now });
    return workspace;
  }

  static restore(state: WorkspaceState): Workspace {
    return new Workspace({
      ...state,
      members: state.members.map((m) => ({ ...m, invitedAt: new Date(m.invitedAt), joinedAt: m.joinedAt ? new Date(m.joinedAt) : null })),
    });
  }

  get id(): string { return this.state.id; }
  get name(): string { return this.state.name; }
  get header(): string { return this.state.header; }
  get ownerUserId(): string { return this.state.ownerUserId; }
  get members(): readonly WorkspaceMember[] { return this.state.members; }
  snapshot(): WorkspaceState { return { ...this.state, members: this.state.members.map((m) => ({ ...m })) }; }

  isOwner(userId: string): boolean {
    return this.state.ownerUserId === userId;
  }

  rename(name: string): void {
    const value = name.trim();
    assert(value.length >= 2 && value.length <= 120, 'workspace.invalid_name', 'Tên tổ/trường phải từ 2 đến 120 ký tự.');
    this.state.name = value;
  }

  setHeader(header: string): void {
    assert(header.trim().length <= 200, 'workspace.invalid_header', 'Tiêu đề in trên đề tối đa 200 ký tự.');
    this.state.header = header.trim();
  }

  invite(rawEmail: string, seatLimit: number, now = new Date()): void {
    const email = Email.of(rawEmail).value;
    if (this.state.members.some((m) => m.email === email)) {
      throw DomainError.conflict('workspace.already_member', 'Địa chỉ này đã có trong danh sách thành viên.');
    }
    if (this.state.members.length >= seatLimit) {
      throw DomainError.paymentRequired('workspace.seats_full', `Đã dùng hết ${seatLimit} chỗ của gói. Hãy mua thêm thành viên.`, { action: 'upgrade' });
    }
    this.state.members.push({ email, userId: null, role: 'MEMBER', invitedAt: now, joinedAt: null });
  }

  /** The invited address signed in: they now spend the shared pool. */
  join(userId: string, email: string, now = new Date()): boolean {
    const member = this.state.members.find((m) => m.email === email.toLowerCase());
    if (!member || member.userId) return false;
    member.userId = userId;
    member.joinedAt = now;
    return true;
  }

  remove(rawEmail: string): void {
    const email = rawEmail.trim().toLowerCase();
    const member = this.state.members.find((m) => m.email === email);
    if (!member) throw DomainError.notFound('workspace.not_member', 'Không có thành viên này.');
    assert(member.role !== 'OWNER', 'workspace.remove_owner', 'Không thể xoá chủ sở hữu khỏi tổ.');
    this.state.members = this.state.members.filter((m) => m !== member);
  }

  roleOf(userId: string): WorkspaceRole | null {
    return this.state.members.find((m) => m.userId === userId)?.role ?? null;
  }
}
