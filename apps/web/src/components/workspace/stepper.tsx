import { Check } from 'lucide-react';
import { cx } from '../ui';

const STEPS = ['Tải lên', 'Chỉnh sửa', 'Xuất file'];

export function Stepper({ current, onSelect }: { current: 0 | 1 | 2; onSelect?: (step: 1 | 2) => void }) {
  return (
    <ol className="flex items-center justify-center gap-2 text-sm sm:gap-4" aria-label="Các bước">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = onSelect && i > 0 && i !== current;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-4">
            {i > 0 && <span className={cx('h-px w-6 sm:w-12', done || active ? 'bg-brand-400' : 'bg-line')} />}
            <button
              disabled={!clickable}
              onClick={() => clickable && onSelect(i as 1 | 2)}
              aria-current={active ? 'step' : undefined}
              className={cx('flex items-center gap-2 rounded-full py-1 pl-1 pr-3', clickable && 'hover:bg-canvas')}
            >
              <span className={cx('grid size-7 place-items-center rounded-full text-xs font-bold',
                done ? 'bg-brand-500 text-white' : active ? 'bg-brand-500 text-white ring-4 ring-brand-100' : 'bg-canvas text-muted')}>
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cx('font-medium', active ? 'text-ink' : 'text-muted')}>{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
