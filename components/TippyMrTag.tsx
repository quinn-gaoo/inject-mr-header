import { useEffect, useRef } from 'react';
import tippy from 'tippy.js';
import { mrTagView } from '@/lib/mrMeta';
import type { MrTagItemProps } from './MrTagPicker';
import { PinIcon } from './icons';

/** MR tag：悬浮时用 Tippy.js 展示 MR 标题。 */
export function TippyMrTag({ item, meta, selected, onSelect }: MrTagItemProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const view = mrTagView(item, meta);

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
      className={`mr-tag${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      aria-label={view.note ? `MR !${item.iid}，备注：${view.note}` : `MR !${item.iid}`}
      onClick={onSelect}
    >
      {view.pinned ? <PinIcon className="mr-tag-pin" /> : null}
      {view.note ? <span className="mr-tag-note">{view.note}</span> : `!${item.iid}`}
    </button>
  );
}
