import { useEffect, useRef } from 'react';
import tippy from 'tippy.js';
import type { MrTagItemProps } from './MrTagPicker';

/** MR tag：悬浮时用 Tippy.js 展示 MR 标题。 */
export function TippyMrTag({ item, selected, onSelect }: MrTagItemProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const instance = tippy(element, {
      content: item.title || `!${item.iid}`,
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
  }, [item.iid, item.title]);

  return (
    <button
      ref={ref}
      type="button"
      className={`mr-tag${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      aria-label={`MR !${item.iid}`}
      onClick={onSelect}
    >
      !{item.iid}
    </button>
  );
}
