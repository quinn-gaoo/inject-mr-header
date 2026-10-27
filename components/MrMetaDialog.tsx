import { useEffect, useState } from 'react';
import { compareMrItems } from '@/lib/mrMeta';
import type { InjectionRule, MrMetaMap, MrOption } from '@/lib/types';
import { CloseIcon, PinIcon } from './icons';
import { Switch } from './Switch';

interface MrMetaDialogProps {
  rule: InjectionRule;
  items: MrOption[];
  onClose: () => void;
  onSave: (meta: MrMetaMap) => void;
}

/** options 里的 MR 标记管理：Pin 与备注。 */
export function MrMetaDialog({ rule, items, onClose, onSave }: MrMetaDialogProps) {
  const [draft, setDraft] = useState<MrMetaMap>(() => ({ ...rule.mrMeta }));
  const sortedItems = [...items].sort((a, b) => compareMrItems(a, b, rule.mrMeta));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const update = (iid: number, patch: { pinned?: boolean; note?: string }) => {
    setDraft((current) => {
      const key = String(iid);
      const next = { ...(current[key] ?? {}), ...patch };
      const pinned = next.pinned === true;
      const note = typeof next.note === 'string' ? next.note : '';
      if (!pinned && !note.trim()) {
        const copy = { ...current };
        delete copy[key];
        return copy;
      }
      return { ...current, [key]: { ...(pinned ? { pinned: true } : {}), note } };
    });
  };

  const handleSave = () => {
    const cleaned: MrMetaMap = {};
    for (const [key, value] of Object.entries(draft)) {
      const note = value.note?.trim() ?? '';
      const pinned = value.pinned === true;
      if (!pinned && !note) continue;
      cleaned[key] = {
        ...(pinned ? { pinned: true } : {}),
        ...(note ? { note } : {}),
      };
    }
    onSave(cleaned);
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal mr-meta-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mr-meta-title"
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="mr-meta-title">
              MR 标记
            </h2>
            <p className="modal-subtitle">
              Pin 优先排序；有备注的 MR 会优先展示备注，悬浮 tag 可查看 MR ID。
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body mr-meta-body">
          {sortedItems.length === 0 ? (
            <p className="mr-meta-empty">当前还没有加载 MR，请先加载 MR 列表。</p>
          ) : (
            sortedItems.map((item) => {
              const meta = draft[String(item.iid)] ?? {};
              return (
                <div className="mr-meta-row" key={item.iid}>
                  <div className="mr-meta-row-head">
                    <span className="mr-meta-id">!{item.iid}</span>
                    <span className="mr-meta-title" title={item.title}>
                      {item.title}
                    </span>
                    <div className="mr-meta-pin">
                      <PinIcon />
                      <span>Pin</span>
                      <Switch
                        checked={meta.pinned === true}
                        onChange={(checked) => update(item.iid, { pinned: checked })}
                        label={`Pin MR !${item.iid}`}
                        size="sm"
                      />
                    </div>
                  </div>
                  <input
                    className="input mr-meta-note-input"
                    type="text"
                    maxLength={120}
                    placeholder="备注（有备注时会替换 tag 上的 MR ID 展示）"
                    value={meta.note ?? ''}
                    onChange={(event) => update(item.iid, { note: event.target.value })}
                  />
                </div>
              );
            })
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            保存标记
          </button>
        </div>
      </div>
    </div>
  );
}
