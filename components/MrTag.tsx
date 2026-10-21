import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import type { MrOption } from '@/lib/types';
import { useHoverClose } from '@/lib/useHoverClose';
import { MrInfoContent } from './MrInfoContent';

interface MrTagProps {
  mr: MrOption;
  selected: boolean;
  onSelect: () => void;
  anchor?: 'left start' | 'bottom start';
}

/** 页面浮层里的 MR tag，悬浮展示 MR 详情，点击选择。 */
export function MrTag({
  mr,
  selected,
  onSelect,
  anchor = 'left start',
}: MrTagProps) {
  const { cancel, schedule } = useHoverClose();

  return (
    <Popover as="span" className="mrh-chip-popover">
      {({ open, close }) => (
        <span
          className="mrh-chip-wrap"
          onMouseEnter={cancel}
          onMouseLeave={() => schedule(close)}
        >
          <PopoverButton
            type="button"
            className={`mrh-chip${selected ? ' is-selected' : ''}`}
            aria-label={`MR !${mr.iid}`}
            onMouseEnter={(event) => {
              if (!open) event.currentTarget.click();
            }}
            onPointerDown={(event) => {
              if (event.button === 0) onSelect();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelect();
            }}
          >
            <span className="mrh-chip-id">!{mr.iid}</span>
          </PopoverButton>
          <PopoverPanel
            anchor={anchor}
            focus={false}
            modal={false}
            className="mr-popover-panel mrh-popover-panel"
            onMouseEnter={cancel}
            onMouseLeave={() => schedule(close)}
          >
            <MrInfoContent info={mr} />
          </PopoverPanel>
        </span>
      )}
    </Popover>
  );
}
