'use client';

import { Coins, LogOut, Menu, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BRAND, MVP } from '@/lib/config';
import { useSession } from '@/lib/session';
import { buttonClass, cx } from './ui';

// GD-3: pricing and rewards are closed in the MVP.
const NAV = MVP
  ? [{ href: '/', label: 'Chuyển đổi' }]
  : [
      { href: '/', label: 'Chuyển đổi' },
      { href: '/pricing', label: 'Bảng giá' },
      { href: '/rewards', label: 'Kiếm credit' },
    ];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold tracking-tight" aria-label={`${BRAND} — trang chủ`}>
      <span className="grid size-8 place-items-center rounded-lg bg-brand-500 text-sm text-white">Đ</span>
      <span className="text-lg">{BRAND}</span>
    </Link>
  );
}

export function Header() {
  const { user, usage, signOut, ready } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Chính">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}
              className={cx('rounded-lg px-3 py-2 text-sm font-medium', pathname === item.href ? 'text-brand-600' : 'text-muted hover:text-ink')}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {ready && user && usage && (
            <Link href="/account" className="flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-sm font-medium" title="Credit còn lại">
              <Coins className="size-4 text-brand-500" /> {usage.credits.toLocaleString('vi-VN')}
              <span className="text-muted">· {usage.tierName}</span>
            </Link>
          )}
          {ready && !MVP && (user ? (
            <>
              <Link href="/account" className={buttonClass('ghost', 'sm')}><User className="size-4" /> {user.name}</Link>
              {user.role === 'ADMIN' && <Link href="/admin" className={buttonClass('ghost', 'sm')}>Quản trị</Link>}
              <button onClick={signOut} className={buttonClass('ghost', 'sm')} aria-label="Đăng xuất"><LogOut className="size-4" /></button>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass('ghost', 'sm')}>Đăng nhập</Link>
              <Link href="/login" className={buttonClass('primary', 'sm')}>Đăng ký miễn phí</Link>
            </>
          ))}
        </div>
        <button className="ml-auto rounded-lg p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Mở menu" aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav className="absolute inset-x-0 top-16 border-b border-line bg-white px-4 pb-4 shadow-lg md:hidden" onClick={() => setOpen(false)}>
          {NAV.map((item) => <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-3 font-medium">{item.label}</Link>)}
          {!MVP && user ? (
            <>
              <Link href="/account" className="block rounded-lg px-3 py-3 font-medium">Tài khoản · {usage?.credits ?? 0} credit</Link>
              {user.role === 'ADMIN' && <Link href="/admin" className="block rounded-lg px-3 py-3 font-medium">Quản trị</Link>}
              <button onClick={signOut} className="block w-full rounded-lg px-3 py-3 text-left font-medium">Đăng xuất</button>
            </>
          ) : !MVP && (
            <Link href="/login" className={buttonClass('primary', 'md', 'mt-2 w-full')}>Đăng nhập / Đăng ký</Link>
          )}
        </nav>
      )}
    </header>
  );
}
