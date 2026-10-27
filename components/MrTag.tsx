import { useEffect, useRef } from 'react';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import '@/styles/tippy-theme.css';
import { mrTagView } from '@/lib/mrMeta';
import type { MrMeta, MrOption } from '@/lib/types';
import { PinIcon } from './icons';

interface MrTagProps {
  mr: MrOption;
  meta?: MrMeta;
  selected: boolean;
  onSelect: () => void;
}

/** options 里的 MR tag：悬浮时用 Tippy.js 展示 MR 标题，点击选择。 */
export function MrTag({ mr, meta, selected, onSelect }: MrTagProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const view = mrTagView(mr, meta);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const instance = tippy(element, {
      content: view.tooltip,
      placement: 'top',
      theme: 'mrh',
      zIndex: 2147483647,
      appendTo: () => document.body,
      popperOptions: { strategy: 'fixed' },
      maxWidth: 320,
      offset: [0, 8],
      delay: [120, 0],
      duration: [120, 80],
      animation: 'fade',
    });
    return () => instance.destroy();
  }, [view.tooltip]);

  return (
    <button
      ref={ref}
      type="button"
      className={`mrh-chip${selected ? ' is-selected' : ''}`}
      aria-label={view.note ? `MR !${mr.iid}，备注：${view.note}` : `MR !${mr.iid}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {view.pinned ? <PinIcon className="mr-tag-pin" /> : null}
      {view.note ? <span className="mr-tag-note">{view.note}</span> : <span className="mrh-chip-id">!{mr.iid}</span>}
    </button>
  );
}
