'use client';

import type { OrderDto } from '@agg/contracts';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ButtonLink, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Where providers send the customer back. The order is confirmed by the provider's server notification, not by this page. */
function Result() {
  const params = useSearchParams();
  const id = params.get('order');
  const { refreshUsage, ready, user } = useSession();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!id || !ready || !user) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const o = await api.order(id).catch(() => null);
      setOrder(o);
      setTries((t) => t + 1);
      if (o?.status === 'PAID') void refreshUsage();
      else if (o?.status === 'PENDING') timer = setTimeout(check, 4000);
    };
    void check();
    return () => clearTimeout(timer);
  }, [id, ready, user, refreshUsage]);

  if (!order) return <div className="py-32"><Spinner className="mx-auto size-10" /></div>;

  const view = {
    PAID: { icon: <CheckCircle2 className="mx-auto size-16 text-ok" />, title: 'Thanh toán thành công', text: `${order.description} đã được kích hoạt. Cảm ơn bạn!` },
    PENDING: { icon: <Clock className="mx-auto size-16 text-warn" />, title: 'Đang chờ xác nhận thanh toán', text: tries > 15 ? 'Việc xác nhận lâu hơn thường lệ. Nếu bạn đã trả tiền, gói sẽ được kích hoạt ngay khi nhận được xác nhận; bạn có thể đóng trang này.' : 'Trang sẽ tự cập nhật khi nhận được xác nhận từ cổng thanh toán.' },
    FAILED: { icon: <XCircle className="mx-auto size-16 text-danger" />, title: 'Thanh toán không thành công', text: 'Bạn chưa bị trừ tiền. Hãy thử lại hoặc chọn cách thanh toán khác.' },
    EXPIRED: { icon: <XCircle className="mx-auto size-16 text-muted" />, title: 'Đơn hàng đã hết hạn', text: 'Nếu bạn đã chuyển khoản, hãy liên hệ hỗ trợ kèm mã đơn.' },
  }[order.status];

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      {view.icon}
      <h1 className="mt-6 text-2xl font-bold">{view.title}</h1>
      <p className="mt-2 text-muted">{view.text}</p>
      <p className="mt-4 font-mono text-sm text-muted">Mã đơn: {order.code}</p>
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href="/">Chuyển bộ đề</ButtonLink>
        <ButtonLink href="/account" variant="secondary">Tài khoản</ButtonLink>
      </div>
    </div>
  );
}

export default function CheckoutResultPage() {
  return <Suspense><Result /></Suspense>;
}
