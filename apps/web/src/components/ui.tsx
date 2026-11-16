import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:border-ink/30 hover:bg-canvas',
  ghost: 'text-ink hover:bg-canvas',
  danger: 'bg-white text-danger border border-danger/30 hover:bg-danger/5',
};
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
  xl: 'h-16 px-10 text-xl gap-3 rounded-2xl font-semibold',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
    VARIANTS[variant], SIZES[size], extra,
  );
}

export function Button({
  variant = 'primary', size = 'md', loading, className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = 'primary', size = 'md', className, children }: {
  href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode;
}) {
  return <Link href={href} className={buttonClass(variant, size, className)}>{children}</Link>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-white', className)}>{children}</div>;
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'brand' | 'ok' | 'warn'; children: ReactNode; className?: string }) {
  const tones = {
    neutral: 'bg-canvas text-muted',
    brand: 'bg-brand-50 text-brand-700',
    ok: 'bg-ok/10 text-ok',
    warn: 'bg-warn/10 text-warn',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-brand-500', className ?? 'size-5')} aria-label="Đang tải" />;
}

const fieldClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100';

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, 'h-10', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldClass, 'h-10', props.className)} />;
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-brand-500" />
      <span>{children}</span>
    </label>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {subtitle && <p className="mx-auto mt-3 max-w-2xl text-lg text-muted">{subtitle}</p>}
    </div>
  );
}
