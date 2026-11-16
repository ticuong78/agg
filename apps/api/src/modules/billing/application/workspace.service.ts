import { Injectable } from '@nestjs/common';
import type { UpdateWorkspaceRequest, WorkspaceDto } from '@agg/contracts';
import { Mailer } from '../../../shared/application/mailer.js';
import type { UserRequester } from '../../../shared/application/requester.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { SubscriptionRepository, WalletRepository, WorkspaceRepository } from '../domain/repositories.js';
import type { Workspace } from '../domain/workspace.js';
import { AccountResolver } from './account-resolver.js';
import { ConfigService } from '@nestjs/config';

/** The school team: its owner manages members and the header printed on statements. */
@Injectable()
export class WorkspaceService {
  private readonly frontendUrl: string;

  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly wallets: WalletRepository,
    private readonly accounts: AccountResolver,
    private readonly mailer: Mailer,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  async mine(requester: UserRequester): Promise<WorkspaceDto | null> {
    const workspace = await this.accounts.workspaceOf(requester);
    return workspace ? this.toDto(workspace, workspace.isOwner(requester.userId)) : null;
  }

  async update(requester: UserRequester, body: UpdateWorkspaceRequest): Promise<WorkspaceDto> {
    const workspace = await this.owned(requester);
    if (body.name !== undefined) workspace.rename(body.name);
    if (body.header !== undefined) workspace.setHeader(body.header);
    await this.workspaces.save(workspace);
    return this.toDto(workspace, true);
  }

  async invite(requester: UserRequester, email: string): Promise<WorkspaceDto> {
    const workspace = await this.owned(requester);
    workspace.invite(email, await this.seatLimit(workspace));
    await this.workspaces.save(workspace);
    await this.mailer.send({
      to: email.trim().toLowerCase(),
      subject: `Bạn được mời vào ${workspace.name}`,
      text: `${workspace.name} đã mời bạn dùng chung gói chuyển đổi đề thi sang Themis.\n\n`
        + `Đăng nhập bằng chính địa chỉ email này tại ${this.frontendUrl}/login để tham gia.`,
    });
    return this.toDto(workspace, true);
  }

  async remove(requester: UserRequester, email: string): Promise<WorkspaceDto> {
    const workspace = await this.owned(requester);
    workspace.remove(email);
    await this.workspaces.save(workspace);
    return this.toDto(workspace, true);
  }

  private async owned(requester: UserRequester): Promise<Workspace> {
    const workspace = await this.workspaces.findByOwner(requester.userId);
    if (!workspace) throw DomainError.forbidden('workspace.not_owner', 'Chỉ người quản lý tổ mới làm được việc này.');
    return workspace;
  }

  private async seatLimit(workspace: Workspace): Promise<number> {
    const plan = await this.subscriptions.findByOwner('WORKSPACE', workspace.id);
    return plan?.isActive() ? plan.seatLimit : 1;
  }

  private async toDto(workspace: Workspace, owner: boolean): Promise<WorkspaceDto> {
    const wallet = await this.wallets.find('WORKSPACE', workspace.id);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const spent = wallet && owner ? await this.wallets.spentByUser(wallet.id, monthStart) : new Map<string, number>();
    return {
      id: workspace.id,
      name: workspace.name,
      header: workspace.header,
      seatLimit: await this.seatLimit(workspace),
      // Members see who is in the team; only the owner sees each member's usage.
      members: workspace.members.map((m) => ({
        email: m.email,
        role: m.role,
        joined: m.userId !== null,
        creditsUsedThisMonth: m.userId ? (spent.get(m.userId) ?? 0) : 0,
      })),
    };
  }
}
