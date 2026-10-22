import type { ComponentType } from 'react';
import type { MrOption, SelectedMr } from '@/lib/types';
import { selectedMrToOption } from '@/lib/format';
import { MrInfoContent } from './MrInfoContent';
import { AlertIcon, RefreshIcon } from './icons';

export interface MrTagItemProps {
  item: MrOption;
  selected: boolean;
  onSelect: () => void;
}

function DefaultMrTag({ item, selected, onSelect }: MrTagItemProps) {
  return (
    <button
      type="button"
      className={`mr-tag${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      title={item.title || `!${item.iid}`}
      onClick={onSelect}
    >
      !{item.iid}
    </button>
  );
}

interface MrTagPickerProps {
  selectedMr: SelectedMr | null;
  items: MrOption[];
  loading: boolean;
  error: string | null;
  configured: boolean;
  repo?: string;
  onSelect: (mr: MrOption | null) => void;
  onRefresh: () => void;
  /** popup 里选中后只展示标题；页面面板展示完整信息。 */
  details?: 'none' | 'title' | 'full';
  /** 自定义 MR tag 渲染器，popup 用 Tippy 悬浮提示，页面面板使用原生 title。 */
  TagComponent?: ComponentType<MrTagItemProps>;
}

/**
 * popup 和页面悬浮面板共享的 MR 选择区：
 * 上方是仓库和加载按钮，下面是 MR ID tag，选中后在下方展示标题或详情。
 */
export function MrTagPicker({
  selectedMr,
  items,
  loading,
  error,
  configured,
  repo,
  onSelect,
  onRefresh,
  details = 'full',
  TagComponent = DefaultMrTag,
}: MrTagPickerProps) {
  const allItems = [...items];
  if (selectedMr && !allItems.some((item) => item.iid === selectedMr.iid)) {
    allItems.push(selectedMrToOption(selectedMr));
  }
  // MR 按编号从高到低展示
  allItems.sort((a, b) => b.iid - a.iid);

  const selectedOption =
    allItems.find((item) => item.iid === selectedMr?.iid) ??
    (selectedMr ? selectedMrToOption(selectedMr) : null);

  return (
    <div className="mr-tag-picker">
      <div className="mr-tag-head">
        {repo ? (
          <span className="mr-tag-repo" title={repo}>
            {repo}
          </span>
        ) : null}
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
              <TagComponent
                key={item.iid}
                item={item}
                selected={isSelected}
                onSelect={() => onSelect(isSelected ? null : item)}
              />
            );
          })}
        </div>
      ) : null}

      {details === 'title' && selectedOption ? (
        <div className="mr-tag-title">{selectedOption.title}</div>
      ) : null}

      {details === 'full' && selectedOption ? (
        <div className="mr-tag-selected">
          <MrInfoContent info={selectedOption} />
        </div>
      ) : null}
    </div>
  );
}
