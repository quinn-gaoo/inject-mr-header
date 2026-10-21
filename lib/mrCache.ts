import { fetchMergeRequests } from './gitlab';
import { readMrCache, writeMrCacheEntry } from './storage';
import type { AppSettings, InjectionRule, MrListResult } from './types';

export interface LoadedMrList {
  result: MrListResult;
  fetchedAt: number;
}

/** 这些字段变化后，旧 MR 缓存不再适用。 */
export function mrQueryKey(settings: AppSettings, rule: InjectionRule): string {
  return [
    settings.gitlabBaseUrl,
    rule.projectPath,
    rule.mrState,
    rule.perPage,
    rule.extraQuery,
  ].join('\u0000');
}

const inflight = new Map<string, Promise<LoadedMrList>>();

export async function getCachedMrList(
  settings: AppSettings,
  rule: InjectionRule,
): Promise<LoadedMrList | null> {
  const cache = await readMrCache();
  const entry = cache[rule.id];
  if (!entry || entry.queryKey !== mrQueryKey(settings, rule)) return null;
  if (
    typeof entry.fetchedAt !== 'number' ||
    !entry.result ||
    !Array.isArray(entry.result.items)
  ) {
    return null;
  }
  return { result: entry.result, fetchedAt: entry.fetchedAt };
}

export async function fetchAndCacheMrList(
  settings: AppSettings,
  rule: InjectionRule,
): Promise<LoadedMrList> {
  const queryKey = mrQueryKey(settings, rule);
  const inflightKey = `${rule.id}\u0000${queryKey}`;
  const pending = inflight.get(inflightKey);
  if (pending) return pending;

  const promise = fetchMergeRequests(settings, {
    projectPath: rule.projectPath,
    state: rule.mrState,
    perPage: rule.perPage,
    extraQuery: rule.extraQuery,
  })
    .then(async (result) => {
      const fetchedAt = Date.now();
      await writeMrCacheEntry({
        ruleId: rule.id,
        queryKey,
        fetchedAt,
        result,
      });
      return { result, fetchedAt };
    })
    .finally(() => {
      inflight.delete(inflightKey);
    });

  inflight.set(inflightKey, promise);
  return promise;
}
