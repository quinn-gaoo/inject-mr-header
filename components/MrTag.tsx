import type { MrOption } from '@/lib/types';

interface MrTagProps {
  mr: MrOption;
  selected: boolean;
  onSelect: () => void;
}

/** options 里的 MR tag：鼠标悬浮通过原生 title 展示 MR 标题，点击选择。 */
export function MrTag({ mr, selected, onSelect }: MrTagProps) {
  return (
    <button
      type="button"
      className={`mrh-chip${selected ? ' is-selected' : ''}`}
      title={mr.title || `!${mr.iid}`}
      aria-label={`MR !${mr.iid}${mr.title ? `：${mr.title}` : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="mrh-chip-id">!{mr.iid}</span>
    </button>
  );
}
