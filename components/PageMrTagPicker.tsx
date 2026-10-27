import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { isExtensionContextInvalidated } from '@/lib/contextError';
import { describeError } from '@/lib/errors';
import { getCachedMrList, type LoadedMrList } from '@/lib/mrCache';
import { isConfigured } from '@/lib/rules';
import type { AppSettings, InjectionRule, MrOption } from '@/lib/types';
import { MrTagPicker } from './MrTagPicker';
import { TippyMrTag } from './TippyMrTag';

interface PageMrTagPickerProps {
  rule: InjectionRule;
  settings: AppSettings;
  onSelect: (mr: MrOption | null) => void;
  onInvalidated: () => void;
}

/**
 * 注入页面里的 MR 选择区：只读 storage 缓存，刷新走 background，
 * 避免 content script 直接请求 GitLab 时被页面 CORS 拦截。
 */
export function PageMrTagPicker({
  rule,
  settings,
  onSelect,
  onInvalidated,
}: PageMrTagPickerProps) {
  const [cache, setCache] = useState<LoadedMrList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadId = useRef(0);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const configured = isConfigured(settings);

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
        if (!alive || loadId.current !== id) return;
        setCache(cached);
        if (!cached && configured) {
          // 规则停用也允许加载，方便在悬浮窗口里继续查看和选择 MR
          void refreshRef.current();
        }
      })
      .catch(() => {
        // 缓存读取失败不阻塞用户手动加载
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const refresh = async () => {
    if (!configured) return;
    const id = loadId.current + 1;
    loadId.current = id;
    setLoading(true);
    setError(null);
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'mrh:refresh-rule-mr',
        ruleId: rule.id,
      })) as { error?: string } | undefined;
      if (!response) throw new Error('扩展后台没有响应，请重试');
      if (response.error) throw new Error(response.error);

      const cached = await getCachedMrList(settings, rule);
      if (loadId.current === id) setCache(cached);
    } catch (cause) {
      if (isExtensionContextInvalidated(cause)) {
        onInvalidated();
        return;
      }
      if (loadId.current === id) setError(describeError(cause));
    } finally {
      if (loadId.current === id) setLoading(false);
    }
  };

  refreshRef.current = refresh;

  const selectedMr =
    rule.selectedMr && rule.selectedMr.projectPath === rule.projectPath
      ? rule.selectedMr
      : null;

  return (
    <MrTagPicker
      selectedMr={selectedMr}
      items={cache?.result.items ?? []}
      loading={loading}
      error={error}
      configured={configured}
      repo={rule.projectPath}
      meta={rule.mrMeta}
      onSelect={onSelect}
      onRefresh={() => void refresh()}
      details="none"
      TagComponent={TippyMrTag}
    />
  );
}
