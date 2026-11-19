'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { forgetAccessKey } from '@/lib/guest-keys';
import { Dialog } from '../dialog';
import { useToast } from '../toast';
import { useApiError } from '../upgrade';
import { Button } from '../ui';

/**
 * GD-7: deletes the set now instead of waiting for the retention sweep, as the privacy page offers. Its access key is
 * forgotten in this browser too, so nothing about it is left behind.
 */
export function DeleteSet({ conversionId }: { conversionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const onError = useApiError();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteConversion(conversionId);
      forgetAccessKey(conversionId);
      toast('ok', 'Đã xoá bộ đề.');
      router.push('/');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Already gone (expired or deleted elsewhere): the outcome the guest asked for, so tidy up the same way.
        forgetAccessKey(conversionId);
        router.push('/');
        return;
      }
      onError(error);
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-muted">
        <Trash2 className="size-4" /> Xoá bộ đề
      </Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} title="Xoá bộ đề này?">
        <div className="space-y-5">
          <p className="text-sm text-muted">Đề bài, test và tên tệp của bộ đề sẽ bị xoá ngay trên máy chủ và không khôi phục được.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Huỷ</Button>
            <Button variant="danger" onClick={remove} loading={busy}>Xoá</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
