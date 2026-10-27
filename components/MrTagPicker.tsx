import type { ComponentType } from 'react';
import type { MrMeta, MrMetaMap, MrOption, SelectedMr } from '@/lib/types';
import { selectedMrToOption } from '@/lib/format';
import { compareMrItems, mrMetaFor, mrTagView } from '@/lib/mrMeta';
import { MrInfoContent } from './MrInfoContent';
import { AlertIcon, PinIcon, RefreshIcon } from './icons';

export interface MrTagItemProps {
  item: MrOption;
  meta?: MrMeta;
  selected: boolean;
  onSelect: () => void;
}

function DefaultMrTag({ item, meta, selected, onSelect }: MrTagItemProps) {
  const view = mrTagView(item, meta);
  return (
    <button
      type="button"
      className={`mr-tag${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      title={view.tooltip}
      onClick={onSelect}
    >
      {view.pinned ? <PinIcon className="mr-tag-pin" /> : null}
      {view.note ? <span className="mr-tag-note">{view.note}</span> : `!${item.iid}`}
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
  meta?: MrMetaMap;
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
  meta,
  onSelect,
  onRefresh,
  details = 'full',
  TagComponent = DefaultMrTag,
}: MrTagPickerProps) {
  const allItems = [...items];
  if (selectedMr && !allItems.some((item) => item.iid === selectedMr.iid)) {
    allItems.push(selectedMrToOption(selectedMr));
  }
  // Pin > 备注 > 其他，同级按编号从高到低
  allItems.sort((a, b) => compareMrItems(a, b, meta));

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
                meta={mrMetaFor(meta, item.iid)}
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
