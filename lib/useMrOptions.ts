import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError } from './errors';
import { fetchAndCacheMrList, getCachedMrList } from './mrCache';
import { isConfigured } from './rules';
import type { AppSettings, InjectionRule, MrListResult } from './types';

export interface MrOptionsApi {
  result: MrListResult | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
  refresh: () => Promise<void>;
}

export function useMrOptions(
  settings: AppSettings,
  rule: InjectionRule,
  enabled = true,
): MrOptionsApi {
  const [result, setResult] = useState<MrListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const configured = isConfigured(settings);

  const key = [
    rule.id,
    settings.gitlabBaseUrl,
    rule.projectPath,
    rule.mrState,
    rule.perPage,
    rule.extraQuery,
  ].join('\u0000');

  const refresh = useCallback(async () => {
    if (!enabled || !configured) {
      setLoading(false);
      return;
    }
    const id = requestId.current + 1;
    requestId.current = id;
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchAndCacheMrList(settings, rule);
      if (requestId.current !== id) return;
      setResult(loaded.result);
    } catch (cause) {
      if (requestId.current === id) setError(describeError(cause));
    } finally {
      if (requestId.current === id) setLoading(false);
    }
    // key 覆盖了所有会影响 MR 请求的字段
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, configured]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const id = requestId.current + 1;
    requestId.current = id;
    setLoading(true);
    setError(null);
    setResult(null);

    void (async () => {
      try {
        const cached = await getCachedMrList(settings, rule);
        if (requestId.current !== id) return;
        if (cached) {
          setResult(cached.result);
          setLoading(false);
          return;
        }

        if (!configured) {
          setLoading(false);
          return;
        }

        const loaded = await fetchAndCacheMrList(settings, rule);
        if (requestId.current !== id) return;
        setResult(loaded.result);
      } catch (cause) {
        if (requestId.current === id) setError(describeError(cause));
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, configured]);

  return { result, loading, error, configured, refresh };
}
