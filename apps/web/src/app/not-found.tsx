import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-bold text-brand-500">404</p>
      <h1 className="mt-4 text-2xl font-bold">Không tìm thấy trang</h1>
      <ButtonLink href="/" className="mt-6">Về trang chủ</ButtonLink>
    </div>
  );
}
