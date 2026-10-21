import { useEffect, useRef, useState } from 'react';
import { describeError } from '@/lib/errors';
import { selectedMrToOption } from '@/lib/format';
import { fetchAndCacheMrList, getCachedMrList, type LoadedMrList } from '@/lib/mrCache';
import { isConfigured } from '@/lib/rules';
import type { AppSettings, InjectionRule, MrOption, SelectedMr } from '@/lib/types';
import { MrTag } from './MrTag';
import { AlertIcon, RefreshIcon } from './icons';

interface RuleMrCacheProps {
  rule: InjectionRule;
  settings: AppSettings;
  selectedMr: SelectedMr | null;
  onSelect?: (mr: MrOption | null) => void;
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
}: RuleMrCacheProps) {
  const configured = isConfigured(settings);
  const [cache, setCache] = useState<LoadedMrList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    items.unshift(selectedMrToOption(selectedMr));
  }

  return (
    <div className="rule-mr-section">
      <div className="rule-subhead">
        <span className="rule-repo" title={rule.projectPath}>
          {rule.projectPath || '未设置仓库'}
        </span>
        <span className="rule-mr-count">{items.length} 个 MR</span>
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
                selected={isSelected}
                anchor="bottom start"
                onSelect={() => onSelect?.(isSelected ? null : item)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
