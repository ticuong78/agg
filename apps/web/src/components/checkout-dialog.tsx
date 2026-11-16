'use client';

import {
  formatVnd, TierCatalog, TopUpPacks, type BankTransferDto, type BillingPeriod, type CheckoutProduct, type PaymentMethodDto, type PaymentProvider,
} from '@agg/contracts';
import { CreditCard, Landmark, Smartphone, Wallet } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Dialog } from './dialog';
import { Button, cx, Field, Input } from './ui';
import { useApiError } from './upgrade';

const ICONS: Record<PaymentProvider, typeof CreditCard> = { VIETQR: Landmark, MOMO: Smartphone, VNPAY: Wallet, STRIPE: CreditCard };
const ORDER: PaymentProvider[] = ['VIETQR', 'MOMO', 'VNPAY', 'STRIPE'];

export function productLabel(product: CheckoutProduct): { title: string; amount: number } {
  if (product.kind === 'TOPUP') {
    const pack = TopUpPacks.find((p) => p.id === product.packId)!;
    return { title: `Gói ${pack.label}`, amount: pack.price };
  }
  const tier = TierCatalog[product.tier];
  const base = (product.period === 'YEAR' ? tier.priceYearly : tier.priceMonthly) ?? 0;
  const seats = (product.extraSeats ?? 0) * (tier.extraSeatMonthly ?? 0) * (product.period === 'YEAR' ? 10 : 1);
  return { title: `Gói ${tier.name} · ${product.period === 'YEAR' ? '12 tháng' : '1 tháng'}`, amount: base + seats };
}

/** Pick a payment method, then go to the provider (or show the transfer QR). The API decides the final price. */
export function CheckoutDialog({ product, onClose }: { product: CheckoutProduct | null; onClose: () => void }) {
  const router = useRouter();
  const onError = useApiError();
  const [methods, setMethods] = useState<PaymentMethodDto[]>([]);
  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState<{ orderId: string; bank: BankTransferDto } | null>(null);

  useEffect(() => {
    if (!product) return;
    setTransfer(null);
    void api.paymentMethods().then((m) => {
      setMethods(m);
      setProvider(ORDER.find((p) => m.find((x) => x.provider === p)?.available) ?? null);
    }).catch(onError);
  }, [product, onError]);

  if (!product) return null;
  const { title, amount } = productLabel(product);
  const isSchool = product.kind === 'PLAN' && product.tier === 'SCHOOL';

  const pay = async () => {
    if (!provider) return;
    setBusy(true);
    try {
      const res = await api.checkout({ product, provider, workspaceName: isSchool ? workspaceName : undefined });
      if (res.redirectUrl) window.location.href = res.redirectUrl;
      else if (res.bankTransfer) setTransfer({ orderId: res.orderId, bank: res.bankTransfer });
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const none = methods.length > 0 && !methods.some((m) => m.available);
  return (
    <Dialog open={!!product} onClose={onClose} title={transfer ? 'Chuyển khoản bằng VietQR' : 'Thanh toán'}>
      {transfer ? (
        <div className="space-y-4 text-center">
          <Image src={transfer.bank.imageUrl} alt="Mã QR chuyển khoản" width={280} height={280} className="mx-auto rounded-xl border border-line" unoptimized />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-sm">
            <dt className="text-muted">Ngân hàng</dt><dd className="font-medium">{transfer.bank.bankName}</dd>
            <dt className="text-muted">Số tài khoản</dt><dd className="font-mono font-medium">{transfer.bank.accountNumber}</dd>
            <dt className="text-muted">Chủ tài khoản</dt><dd className="font-medium">{transfer.bank.accountName}</dd>
            <dt className="text-muted">Số tiền</dt><dd className="font-medium">{formatVnd(transfer.bank.amount)}</dd>
            <dt className="text-muted">Nội dung</dt><dd className="font-mono font-bold text-brand-600">{transfer.bank.content}</dd>
          </dl>
          <p className="text-xs text-muted">Quét mã bằng ứng dụng ngân hàng: số tiền và nội dung đã điền sẵn. Gói được kích hoạt tự động trong vài phút sau khi tiền về.</p>
          <Button className="w-full" onClick={() => router.push(`/checkout/result?order=${transfer.orderId}`)}>Tôi đã chuyển khoản</Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-baseline justify-between rounded-xl bg-canvas p-4">
            <span className="font-medium">{title}</span>
            <span className="text-xl font-bold">{formatVnd(amount)}</span>
          </div>
          {isSchool && (
            <Field label="Tên tổ / trường" hint="Hiển thị cho thành viên bạn mời.">
              <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Tổ Tin học — THPT Chuyên A" maxLength={120} />
            </Field>
          )}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Cách thanh toán</legend>
            {ORDER.map((p) => {
              const method = methods.find((m) => m.provider === p);
              const Icon = ICONS[p];
              return (
                <label key={p} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border p-3', provider === p ? 'border-brand-400 bg-brand-50' : 'border-line',
                  !method?.available && 'cursor-not-allowed opacity-50')}>
                  <input type="radio" name="provider" className="accent-brand-500" disabled={!method?.available} checked={provider === p} onChange={() => setProvider(p)} />
                  <Icon className="size-5 text-brand-500" />
                  <span className="text-sm font-medium">{method?.label ?? p}</span>
                  {!method?.available && <span className="ml-auto text-xs text-muted">Sắp có</span>}
                </label>
              );
            })}
          </fieldset>
          {none && <p className="text-sm text-warn">Thanh toán trực tuyến đang được thiết lập. Vui lòng liên hệ để được kích hoạt gói thủ công.</p>}
          <Button size="lg" className="w-full" loading={busy} disabled={!provider} onClick={pay}>Thanh toán {formatVnd(amount)}</Button>
          <p className="text-center text-xs text-muted">Thanh toán một lần, không tự động gia hạn. Cần hoá đơn VAT? Ghi chú khi liên hệ hỗ trợ.</p>
        </div>
      )}
    </Dialog>
  );
}

export type { BillingPeriod };
