import type { MrOption, SelectedMr } from '@/lib/types';
import { selectedMrToOption } from '@/lib/format';
import { MrInfoContent } from './MrInfoContent';
import { AlertIcon, RefreshIcon } from './icons';

interface MrTagPickerProps {
  selectedMr: SelectedMr | null;
  items: MrOption[];
  loading: boolean;
  error: string | null;
  configured: boolean;
  onSelect: (mr: MrOption | null) => void;
  onRefresh: () => void;
}

/**
 * popup 和页面悬浮面板共享的 MR 选择区：
 * 上方是 MR ID tag，下方展示当前选中 MR 的信息。
 */
export function MrTagPicker({
  selectedMr,
  items,
  loading,
  error,
  configured,
  onSelect,
  onRefresh,
}: MrTagPickerProps) {
  const allItems = [...items];
  if (selectedMr && !allItems.some((item) => item.iid === selectedMr.iid)) {
    allItems.unshift(selectedMrToOption(selectedMr));
  }

  const selectedOption =
    allItems.find((item) => item.iid === selectedMr?.iid) ??
    (selectedMr ? selectedMrToOption(selectedMr) : null);

  return (
    <div className="mr-tag-picker">
      <div className="mr-tag-head">
        <span className="mr-tag-count">{allItems.length} 个 MR</span>
        <button
          type="button"
          className="mr-tag-refresh"
          disabled={!configured || loading}
          onClick={onRefresh}
        >
          {loading ? <span className="spinner" /> : <RefreshIcon />}
          {loading ? '加载中' : allItems.length > 0 ? '刷新 MR' : '加载 MR'}
        </button>
      </div>

      {error ? (
        <div className="mr-tag-error">
          <AlertIcon />
          <span className="flex-1">{error}</span>
          <button type="button" className="link-btn" onClick={onRefresh}>
            重试
          </button>
        </div>
      ) : null}

      {allItems.length > 0 ? (
        <div className="mr-tag-list">
          {allItems.map((item) => {
            const isSelected = selectedMr?.iid === item.iid;
            return (
              <button
                key={item.iid}
                type="button"
                className={`mr-tag${isSelected ? ' is-selected' : ''}`}
                aria-pressed={isSelected}
                onClick={() => onSelect(isSelected ? null : item)}
              >
                !{item.iid}
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedOption ? (
        <div className="mr-tag-selected">
          <MrInfoContent info={selectedOption} />
        </div>
      ) : null}
    </div>
  );
}
