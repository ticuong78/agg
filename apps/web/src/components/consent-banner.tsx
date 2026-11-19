'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MVP } from '@/lib/config';
import { useTracking } from '@/lib/tracking';
import { Button, Checkbox } from './ui';

/**
 * Asked once. "Only necessary" is as easy to pick as "Accept all" (same size, first in reading order), and the
 * choice can be changed later from the privacy page.
 */
export function ConsentBanner() {
  const { consent, decide } = useTracking();
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // The choice lives in this browser: render nothing on the server.
  useEffect(() => setMounted(true), []);
  // GD-3: nothing is tracked in the MVP, so there is nothing to ask.
  if (MVP || !mounted || consent) return null;

  return (
    <div role="dialog" aria-label="Lựa chọn quyền riêng tư" className="animate-rise fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-line bg-white p-5 shadow-2xl">
      <p className="text-sm">
        Chúng tôi dùng bộ nhớ trình duyệt <strong>cần thiết</strong> để giữ phiên làm việc và lượt miễn phí của bạn.
        Nếu bạn đồng ý, chúng tôi ghi nhận thêm <strong>thống kê sử dụng</strong> (không dùng công cụ bên thứ ba) và
        có thể gửi <strong>thông tin sản phẩm</strong>. <Link href="/privacy#cookie" className="underline">Tìm hiểu thêm</Link>
      </p>
      {custom && (
        <div className="mt-4 space-y-2 rounded-xl bg-canvas p-4">
          <p className="text-sm text-muted">✓ Cần thiết (luôn bật): phiên đăng nhập, lượt miễn phí, chống lạm dụng</p>
          <Checkbox checked={analytics} onChange={setAnalytics}>Thống kê sử dụng: trang đã xem, tính năng đã dùng, để cải thiện sản phẩm</Checkbox>
          <Checkbox checked={marketing} onChange={setMarketing}>Tiếp thị: email về tính năng mới và ưu đãi</Checkbox>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => decide(false, false)}>Chỉ cần thiết</Button>
        {custom
          ? <Button variant="secondary" onClick={() => decide(analytics, marketing)}>Lưu lựa chọn</Button>
          : <Button variant="ghost" onClick={() => setCustom(true)}>Tuỳ chỉnh</Button>}
        <Button onClick={() => decide(true, true)}>Đồng ý tất cả</Button>
      </div>
    </div>
  );
}
