'use client';

import { Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Card, Checkbox, Field, Input } from '@/components/ui';
import { useApiError } from '@/components/upgrade';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { storedReferralCode } from '@/lib/tracking';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signedIn } = useSession();
  const onError = useApiError();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);

  const next = params.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.requestCode(email);
      setStage('code');
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.verifyCode({
        email, code, name: name.trim() || undefined, marketingConsent: marketing,
        referralCode: params.get('ref') ?? storedReferralCode(),
      });
      await signedIn(res.token, res.user);
      router.replace(target);
    } catch (error) {
      onError(error);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-bold">Đăng nhập hoặc đăng ký</h1>
      <p className="mt-2 text-center text-muted">Không cần mật khẩu. Tài khoản mới nhận ngay 30 credit.</p>
      <Card className="mt-8 p-6">
        {stage === 'email' ? (
          <form onSubmit={sendCode} className="space-y-4">
            <Field label="Email">
              <Input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ten@truong.edu.vn" />
            </Field>
            <Button type="submit" size="lg" loading={busy} className="w-full"><Mail className="size-5" /> Gửi mã đăng nhập</Button>
            <p className="text-center text-xs text-muted">
              Khi tiếp tục, bạn đồng ý với <Link href="/terms" className="underline">Điều khoản</Link> và <Link href="/privacy" className="underline">Chính sách quyền riêng tư</Link>.
            </p>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm">Đã gửi mã 6 số tới <strong>{email}</strong>. Mã có hiệu lực 10 phút; hãy xem cả thư mục Spam.</p>
            <Field label="Mã đăng nhập">
              <Input inputMode="numeric" autoComplete="one-time-code" required maxLength={6} autoFocus value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center font-mono text-2xl tracking-[0.5em]" />
            </Field>
            <Field label="Tên hiển thị (nếu là tài khoản mới)">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Cô Lan" />
            </Field>
            <Checkbox checked={marketing} onChange={setMarketing}>Nhận email về tính năng mới và ưu đãi (có thể huỷ bất cứ lúc nào)</Checkbox>
            <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6} className="w-full">Đăng nhập</Button>
            <button type="button" className="w-full text-sm text-muted hover:text-ink" onClick={() => { setStage('email'); setCode(''); }}>Đổi email / gửi lại mã</button>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
