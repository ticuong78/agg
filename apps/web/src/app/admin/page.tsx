'use client';

import type { LeadDto, Page, ReviewItemDto } from '@agg/contracts';
import { Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, cx, Input } from '@/components/ui';
import { useApiError } from '@/components/upgrade';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Back office: the lead list for sales, and the reward claims waiting for a person. */
export default function AdminPage() {
  const router = useRouter();
  const { ready, user } = useSession();
  const [tab, setTab] = useState<'leads' | 'reviews'>('leads');

  useEffect(() => {
    if (ready && user?.role !== 'ADMIN') router.replace('/');
  }, [ready, user, router]);
  if (user?.role !== 'ADMIN') return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold">Quản trị</h1>
      <div className="mt-6 flex gap-2">
        {(['leads', 'reviews'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx('rounded-lg px-4 py-2 text-sm font-medium', tab === t ? 'bg-ink text-white' : 'bg-canvas')}>
            {t === 'leads' ? 'Khách hàng tiềm năng' : 'Duyệt thưởng'}
          </button>
        ))}
      </div>
      <div className="mt-6">{tab === 'leads' ? <Leads /> : <Reviews />}</div>
    </div>
  );
}

function Leads() {
  const onError = useApiError();
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page<LeadDto> | null>(null);

  const load = useCallback(() => { void api.leads(offset, q).then(setPage).catch(onError); }, [offset, q, onError]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Tìm email, tên, đơn vị" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} className="max-w-xs" />
        <span className="text-sm text-muted">{page?.total ?? 0} người</span>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={() => api.downloadLeads().catch(onError)}>
          <Download className="size-4" /> CSV (đã đồng ý tiếp thị)
        </Button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 font-normal">Email</th><th className="font-normal">Tên / đơn vị</th><th className="font-normal">Nguồn</th><th className="font-normal">Tiếp thị</th><th className="font-normal">Thông tin</th><th className="font-normal">Cập nhật</th></tr></thead>
          <tbody>
            {page?.items.map((l) => (
              <tr key={l.id} className="border-b border-line align-top">
                <td className="py-2">{l.email}{l.phone && <span className="block text-xs text-muted">{l.phone}</span>}</td>
                <td>{l.name}<span className="block text-xs text-muted">{l.organization}</span></td>
                <td><div className="flex flex-wrap gap-1">{l.sources.map((s) => <Badge key={s}>{s}</Badge>)}</div></td>
                <td>{l.marketingConsent ? <Badge tone="ok">Có</Badge> : <Badge>Không</Badge>}</td>
                <td className="max-w-xs text-xs text-muted">{Object.entries(l.attributes).map(([k, v]) => <span key={k} className="block truncate" title={v}><strong>{k}:</strong> {v}</span>)}</td>
                <td className="text-xs text-muted">{new Date(l.updatedAt).toLocaleDateString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 50))}>Trước</Button>
        <Button variant="secondary" size="sm" disabled={!page || offset + 50 >= page.total} onClick={() => setOffset((o) => o + 50)}>Sau</Button>
      </div>
    </Card>
  );
}

function Reviews() {
  const onError = useApiError();
  const toast = useToast();
  const [items, setItems] = useState<ReviewItemDto[]>([]);
  const [credits, setCredits] = useState<Record<string, number>>({});
  const load = useCallback(() => { void api.reviews().then(setItems).catch(onError); }, [onError]);
  useEffect(load, [load]);

  const decide = async (item: ReviewItemDto, approve: boolean) => {
    try {
      await api.decide(item.id, { approve, credits: approve ? (credits[item.id] ?? (item.kind === 'BUG_REPORT' ? 10 : 50)) : undefined });
      toast('ok', approve ? 'Đã duyệt và cộng credit.' : 'Đã từ chối.');
      load();
    } catch (error) {
      onError(error);
    }
  };

  if (!items.length) return <p className="text-muted">Không có yêu cầu nào đang chờ.</p>;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.kind === 'BUG_REPORT' ? 'warn' : 'brand'}>{item.kind === 'BUG_REPORT' ? 'Báo lỗi' : 'Phỏng vấn'}</Badge>
            <span className="font-semibold">{item.title}</span>
            <span className="text-sm text-muted">{item.userEmail} · {new Date(item.createdAt).toLocaleString('vi-VN')}</span>
          </div>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-canvas p-3 text-xs">{item.body}</pre>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {item.kind === 'BUG_REPORT' && (
              <Input type="number" min={10} max={50} value={credits[item.id] ?? 10} onChange={(e) => setCredits((c) => ({ ...c, [item.id]: Number(e.target.value) }))} className="w-24" aria-label="Số credit" />
            )}
            <Button size="sm" onClick={() => decide(item, true)}>Duyệt</Button>
            <Button size="sm" variant="ghost" onClick={() => decide(item, false)}>Từ chối</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
