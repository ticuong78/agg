'use client';

import { formatVnd, PaymentProviderLabels, type ConversionSummaryDto, type LedgerEntryDto, type OrderDto, type WorkspaceDto } from '@agg/contracts';
import { Coins, Trash2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, ButtonLink, Card, Checkbox, Field, Input, Spinner } from '@/components/ui';
import { useApiError } from '@/components/upgrade';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const date = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

export default function AccountPage() {
  const router = useRouter();
  const { ready, user, usage, setUser, signOut } = useSession();
  const onError = useApiError();
  const toast = useToast();
  const [ledger, setLedger] = useState<LedgerEntryDto[]>([]);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [history, setHistory] = useState<ConversionSummaryDto[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace('/login?next=/account');
    if (!user) return;
    void Promise.all([api.ledger(), api.orders(), api.conversions(), api.workspace()])
      .then(([l, o, c, w]) => { setLedger(l); setOrders(o); setHistory(c); setWorkspace(w); })
      .catch(onError);
  }, [ready, user, router, onError]);

  if (!user || !usage) return <div className="py-32"><Spinner className="mx-auto size-10" /></div>;

  const deleteAccount = async () => {
    if (!window.confirm('Xoá vĩnh viễn tài khoản, credit còn lại và mọi bộ đề? Không thể hoàn tác.')) return;
    try {
      await api.deleteMe();
      signOut();
      toast('ok', 'Tài khoản và dữ liệu đã được xoá.');
      router.replace('/');
    } catch (error) {
      onError(error);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Xin chào, {user.name}</h1>
          <p className="text-muted">{user.email}</p>
        </div>
        <ButtonLink href="/">Chuyển bộ đề mới</ButtonLink>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <p className="flex items-center gap-2 text-sm text-muted"><Coins className="size-4 text-brand-500" /> Credit còn lại</p>
          <p className="mt-2 text-4xl font-bold">{usage.credits.toLocaleString('vi-VN')}</p>
          {usage.buckets.filter((b) => b.expiresAt).slice(0, 2).map((b) => (
            <p key={`${b.source}${b.expiresAt}`} className="mt-1 text-xs text-muted">{b.remaining} credit hết hạn {date(b.expiresAt!)}</p>
          ))}
          <div className="mt-4 flex gap-2"><ButtonLink href="/pricing" size="sm">Mua thêm</ButtonLink><ButtonLink href="/rewards" size="sm" variant="secondary">Kiếm miễn phí</ButtonLink></div>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted">Gói hiện tại</p>
          <p className="mt-2 text-2xl font-bold">{usage.tierName}</p>
          {usage.plan && <p className="mt-1 text-sm text-muted">Đến {date(usage.plan.endsAt)}</p>}
          {usage.workspace && <p className="mt-1 text-sm text-muted">Dùng chung với {usage.workspace.name}</p>}
          {usage.guest && <p className="mt-1 text-sm text-muted">Hôm nay: {usage.guest.usedToday}/{usage.guest.dailyLimit} lượt</p>}
          <ButtonLink href="/pricing" size="sm" variant="secondary" className="mt-4">{usage.plan ? 'Gia hạn / nâng cấp' : 'Nâng cấp'}</ButtonLink>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted">Mời đồng nghiệp</p>
          <p className="mt-2 font-mono text-lg font-bold">{user.referralCode}</p>
          <p className="mt-1 text-sm text-muted">+30 credit cho bạn mỗi người dùng thử thành công.</p>
          <ButtonLink href="/rewards" size="sm" variant="secondary" className="mt-4">Lấy đường dẫn mời</ButtonLink>
        </Card>
      </div>

      {workspace && <WorkspacePanel workspace={workspace} owner={usage.workspace?.role === 'OWNER'} onChange={setWorkspace} />}

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Bộ đề gần đây</h2>
        {history.length === 0 ? <p className="mt-3 text-sm text-muted">Chưa có bộ đề nào.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {history.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3 text-sm">
                <Link href={`/c/${c.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand-600">{c.name}</Link>
                <span className="text-muted">{c.problemCount} bài</span>
                <span className="hidden text-muted sm:inline">{date(c.createdAt)}</span>
                {c.status !== 'READY' && <Badge tone="warn">{c.status === 'FAILED' ? 'Lỗi' : 'Đang xử lý'}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Lịch sử credit</h2>
          <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto text-sm">
            {ledger.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{l.reason}<span className="ml-2 text-xs text-muted">{date(l.at)}</span></span>
                <span className={l.amount > 0 ? 'font-medium text-ok' : 'text-muted'}>{l.amount > 0 ? '+' : ''}{l.amount}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Đơn hàng</h2>
          {orders.length === 0 ? <p className="mt-3 text-sm text-muted">Chưa có đơn hàng.</p> : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0"><span className="block truncate">{o.description}</span><span className="text-xs text-muted">{o.code} · {PaymentProviderLabels[o.provider]} · {date(o.createdAt)}</span></span>
                  <span className="text-right"><span className="block font-medium">{formatVnd(o.amount)}</span>
                    <Badge tone={o.status === 'PAID' ? 'ok' : o.status === 'PENDING' ? 'warn' : 'neutral'}>{{ PAID: 'Đã thanh toán', PENDING: 'Chờ thanh toán', FAILED: 'Thất bại', EXPIRED: 'Hết hạn' }[o.status]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Quyền riêng tư</h2>
        <Checkbox checked={user.marketingConsent} onChange={async (v) => setUser(await api.updateMe({ marketingConsent: v }))}>
          Nhận email về tính năng mới và ưu đãi
        </Checkbox>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button variant="danger" size="sm" onClick={deleteAccount}><Trash2 className="size-4" /> Xoá tài khoản và dữ liệu</Button>
          <p className="text-xs text-muted">Xoá ngay hồ sơ, bộ đề, credit, lịch sử. Đơn hàng được giữ theo luật kế toán. <Link href="/data-protection#quyen" className="underline">Quyền của bạn</Link></p>
        </div>
      </Card>
    </div>
  );
}

function WorkspacePanel({ workspace, owner, onChange }: { workspace: WorkspaceDto; owner: boolean; onChange: (w: WorkspaceDto) => void }) {
  const onError = useApiError();
  const [email, setEmail] = useState('');
  const [header, setHeader] = useState(workspace.header);
  const run = async (fn: () => Promise<WorkspaceDto>) => {
    try {
      onChange(await fn());
    } catch (error) {
      onError(error);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{workspace.name}</h2>
        <Badge>{workspace.members.length}/{workspace.seatLimit} thành viên</Badge>
      </div>
      {owner && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => api.invite(email)).then(() => setEmail('')); }}>
            <Field label="Mời giáo viên bằng email" className="flex-1"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Button type="submit"><UserPlus className="size-4" /> Mời</Button>
          </form>
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => api.updateWorkspace({ header })); }}>
            <Field label="Tiêu đề in trên đề" className="flex-1"><Input value={header} onChange={(e) => setHeader(e.target.value)} maxLength={200} placeholder="THPT Chuyên A — Tổ Tin học" /></Field>
            <Button type="submit" variant="secondary">Lưu</Button>
          </form>
        </div>
      )}
      <table className="mt-4 w-full text-sm">
        <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 font-normal">Email</th><th className="font-normal">Trạng thái</th>{owner && <th className="font-normal">Credit tháng này</th>}<th /></tr></thead>
        <tbody>
          {workspace.members.map((m) => (
            <tr key={m.email} className="border-b border-line">
              <td className="py-2">{m.email} {m.role === 'OWNER' && <Badge tone="brand">Quản lý</Badge>}</td>
              <td>{m.joined ? 'Đã tham gia' : 'Đã mời'}</td>
              {owner && <td>{m.creditsUsedThisMonth}</td>}
              <td className="text-right">{owner && m.role !== 'OWNER' && (
                <button onClick={() => run(() => api.removeMember(m.email))} className="text-muted hover:text-danger" aria-label={`Xoá ${m.email}`}><Trash2 className="size-4" /></button>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
