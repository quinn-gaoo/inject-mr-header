import { useEffect, useRef, useState } from 'react';
import { describeError } from '@/lib/errors';
import { selectedMrToOption } from '@/lib/format';
import { fetchAndCacheMrList, getCachedMrList, type LoadedMrList } from '@/lib/mrCache';
import { compareMrItems, mrMetaFor } from '@/lib/mrMeta';
import { isConfigured } from '@/lib/rules';
import type { AppSettings, InjectionRule, MrMetaMap, MrOption, SelectedMr } from '@/lib/types';
import { MrMetaDialog } from './MrMetaDialog';
import { MrTag } from './MrTag';
import { AlertIcon, NoteIcon, RefreshIcon } from './icons';

interface RuleMrCacheProps {
  rule: InjectionRule;
  settings: AppSettings;
  selectedMr: SelectedMr | null;
  onSelect?: (mr: MrOption | null) => void;
  onSaveMeta?: (meta: MrMetaMap) => void;
}

/**
 * options 里的 MR 数据加载器：手动加载/刷新后写入 storage.local，
 * 之后 popup 命中该规则时可以直接使用缓存。
 */
export function RuleMrCache({
  rule,
  settings,
  selectedMr,
  onSelect,
  onSaveMeta,
}: RuleMrCacheProps) {
  const configured = isConfigured(settings);
  const [cache, setCache] = useState<LoadedMrList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);
  const loadId = useRef(0);

  const cacheKey = [
    settings.gitlabBaseUrl,
    rule.id,
    rule.projectPath,
    rule.mrState,
    rule.perPage,
    rule.extraQuery,
  ].join('\u0000');

  useEffect(() => {
    const id = loadId.current + 1;
    loadId.current = id;
    let alive = true;
    setCache(null);
    setError(null);
    setLoading(false);

    void getCachedMrList(settings, rule)
      .then((cached) => {
        if (alive && loadId.current === id) setCache(cached);
      })
      .catch(() => {
        // 缓存读取失败时不阻塞，用户可以手动加载
      });

    return () => {
      alive = false;
    };
    // cacheKey 覆盖了所有影响缓存的字段
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const handleLoad = async () => {
    if (!configured) return;
    const id = loadId.current + 1;
    loadId.current = id;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAndCacheMrList(settings, rule);
      if (loadId.current === id) setCache(next);
    } catch (cause) {
      if (loadId.current === id) setError(describeError(cause));
    } finally {
      if (loadId.current === id) setLoading(false);
    }
  };

  const items = cache ? [...cache.result.items] : [];
  if (selectedMr && !items.some((item) => item.iid === selectedMr.iid)) {
    items.push(selectedMrToOption(selectedMr));
  }
  // Pin > 备注 > 其他，同级按编号从高到低
  items.sort((a, b) => compareMrItems(a, b, rule.mrMeta));

  return (
    <div className="rule-mr-section">
      <div className="rule-subhead">
        <span className="rule-repo" title={rule.projectPath}>
          {rule.projectPath || '未设置仓库'}
        </span>
        <span className="rule-mr-count">{items.length} 个 MR</span>
        {onSaveMeta && items.length > 0 ? (
          <button type="button" className="rule-refresh" onClick={() => setMetaOpen(true)}>
            <NoteIcon />
            标记
          </button>
        ) : null}
        <button
          type="button"
          className="rule-refresh"
          disabled={!configured || loading}
          onClick={() => void handleLoad()}
        >
          {loading ? <span className="spinner" /> : <RefreshIcon />}
          {loading ? '加载中' : cache ? '刷新 MR' : '加载 MR'}
        </button>
      </div>

      {error ? (
        <div className="rule-mr-cache-error">
          <AlertIcon />
          <span className="flex-1">{error}</span>
          <button type="button" className="link-btn" onClick={() => void handleLoad()}>
            重试
          </button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="rule-mr-tags">
          {items.map((item) => {
            const isSelected = selectedMr?.iid === item.iid;
            return (
              <MrTag
                key={item.iid}
                mr={item}
                meta={mrMetaFor(rule.mrMeta, item.iid)}
                selected={isSelected}
                onSelect={() => onSelect?.(isSelected ? null : item)}
              />
            );
          })}
        </div>
      ) : null}

      {metaOpen && onSaveMeta ? (
        <MrMetaDialog
          rule={rule}
          items={items}
          onClose={() => setMetaOpen(false)}
          onSave={onSaveMeta}
        />
      ) : null}
    </div>
  );
}
