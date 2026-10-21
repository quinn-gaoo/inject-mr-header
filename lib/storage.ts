import { browser } from 'wxt/browser';
import { parseDomainInput } from './domain';
import {
  DEFAULT_SETTINGS,
  isMrState,
  type AppSettings,
  type InjectionRule,
  type MrCacheEntry,
  type MrCacheMap,
  type SelectedMr,
  type StoredAppState,
} from './types';

export const SETTINGS_KEY = 'mrh:settings';
export const RULES_KEY = 'mrh:rules';
export const MR_CACHE_KEY = 'mrh:mr-cache';

let rulesQueue: Promise<unknown> = Promise.resolve();
let settingsQueue: Promise<unknown> = Promise.resolve();
let cacheQueue: Promise<unknown> = Promise.resolve();

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSettings(raw: unknown): AppSettings {
  const value = raw && typeof raw === 'object' ? (raw as Partial<AppSettings>) : {};
  return {
    gitlabBaseUrl:
      typeof value.gitlabBaseUrl === 'string' ? value.gitlabBaseUrl : DEFAULT_SETTINGS.gitlabBaseUrl,
    token: typeof value.token === 'string' ? value.token : DEFAULT_SETTINGS.token,
    masterEnabled: value.masterEnabled !== false,
    pageOverlayEnabled: value.pageOverlayEnabled !== false,
  };
}

function normalizeSelectedMr(raw: unknown): SelectedMr | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<SelectedMr>;
  if (typeof value.iid !== 'number' || !Number.isFinite(value.iid) || value.iid <= 0) return null;
  return {
    iid: Math.round(value.iid),
    title: typeof value.title === 'string' ? value.title : `!${value.iid}`,
    state: typeof value.state === 'string' ? value.state : 'opened',
    webUrl: typeof value.webUrl === 'string' ? value.webUrl : '',
    sourceBranch: typeof value.sourceBranch === 'string' ? value.sourceBranch : undefined,
    targetBranch: typeof value.targetBranch === 'string' ? value.targetBranch : undefined,
    authorName: typeof value.authorName === 'string' ? value.authorName : undefined,
    projectPath: typeof value.projectPath === 'string' ? value.projectPath : '',
    selectedAt: typeof value.selectedAt === 'number' ? value.selectedAt : Date.now(),
  };
}

function normalizeRule(raw: unknown, index: number): InjectionRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<InjectionRule>;
  const now = Date.now();
  const rawDomain = typeof value.domain === 'string' ? value.domain : '';
  const parsedDomain = rawDomain ? parseDomainInput(rawDomain) : null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    domain: parsedDomain?.ok ? parsedDomain.domain : rawDomain,
    headerName:
      typeof value.headerName === 'string' && value.headerName.trim()
        ? value.headerName.trim()
        : 'X-MR-ID',
    projectPath: typeof value.projectPath === 'string' ? value.projectPath : '',
    mrState: isMrState(value.mrState) ? value.mrState : 'opened',
    perPage:
      typeof value.perPage === 'number' && Number.isFinite(value.perPage)
        ? Math.min(100, Math.max(1, Math.round(value.perPage)))
        : 100,
    extraQuery: typeof value.extraQuery === 'string' ? value.extraQuery : '',
    enabled: value.enabled !== false,
    selectedMr: normalizeSelectedMr(value.selectedMr),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now - index,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now - index,
  };
}

export async function readSettings(): Promise<AppSettings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(result[SETTINGS_KEY]);
}

export async function readRules(): Promise<InjectionRule[]> {
  const result = await browser.storage.local.get(RULES_KEY);
  const raw = result[RULES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => normalizeRule(item, index))
    .filter((item): item is InjectionRule => item !== null);
}

export async function readAppState(): Promise<StoredAppState> {
  const [settings, rules] = await Promise.all([readSettings(), readRules()]);
  return { settings, rules };
}

export function patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const run = async (): Promise<AppSettings> => {
    const current = await readSettings();
    const next = normalizeSettings({ ...current, ...patch });
    await browser.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  };
  const promise = settingsQueue.then(run, run);
  settingsQueue = promise.catch(() => undefined);
  return promise;
}

export async function writeRules(rules: InjectionRule[]): Promise<void> {
  await browser.storage.local.set({ [RULES_KEY]: rules });
}

/**
 * 串行地读取-修改-写入规则，避免快速连点导致后一次覆盖前一次。
 */
export function mutateRules<T>(
  updater: (rules: InjectionRule[]) => T | Promise<T>,
): Promise<T> {
  const run = async (): Promise<T> => {
    const rules = await readRules();
    const result = await updater(rules);
    await writeRules(rules);
    return result;
  };
  const promise = rulesQueue.then(run, run);
  rulesQueue = promise.catch(() => undefined);
  return promise;
}

export async function readMrCache(): Promise<MrCacheMap> {
  const result = await browser.storage.local.get(MR_CACHE_KEY);
  const raw = result[MR_CACHE_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as MrCacheMap;
}

export function writeMrCacheEntry(entry: MrCacheEntry): Promise<void> {
  const run = async (): Promise<void> => {
    const cache = await readMrCache();
    cache[entry.ruleId] = entry;
    await browser.storage.local.set({ [MR_CACHE_KEY]: cache });
  };
  const promise = cacheQueue.then(run, run);
  cacheQueue = promise.catch(() => undefined);
  return promise;
}

export function clearMrCacheForRule(ruleId: string): Promise<void> {
  const run = async (): Promise<void> => {
    const cache = await readMrCache();
    if (!(ruleId in cache)) return;
    delete cache[ruleId];
    await browser.storage.local.set({ [MR_CACHE_KEY]: cache });
  };
  const promise = cacheQueue.then(run, run);
  cacheQueue = promise.catch(() => undefined);
  return promise;
}

export function subscribeToAppState(listener: () => void): () => void {
  const handler = (
    changes: Record<string, unknown>,
    areaName: string,
  ): void => {
    if (areaName !== 'local') return;
    if (SETTINGS_KEY in changes || RULES_KEY in changes) listener();
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}
