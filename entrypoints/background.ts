import { browser } from 'wxt/browser';
import { getHostname, hostMatchesDomain } from '@/lib/domain';
import { replaceDynamicRules } from '@/lib/dnr';
import { describeError } from '@/lib/errors';
import { fetchAndCacheMrList } from '@/lib/mrCache';
import {
  buildDynamicRules,
  countActiveRules,
  isConfigured,
  isRuleActive,
} from '@/lib/rules';
import {
  RULES_KEY,
  SETTINGS_KEY,
  readAppState,
} from '@/lib/storage';
import type {
  AppSettings,
  InjectionRule,
  InjectionStatus,
} from '@/lib/types';

interface Snapshot {
  settings: AppSettings;
  rules: InjectionRule[];
}

interface ActionApi {
  setBadgeText(details: { tabId?: number; text: string }): Promise<unknown> | void;
  setIcon(details: {
    tabId?: number;
    path: string | Record<string, string>;
  }): Promise<unknown> | void;
  setTitle(details: { tabId?: number; title: string }): Promise<unknown> | void;
}

const DEFAULT_ICON: Record<string, string> = {
  '16': 'icon/16.png',
  '32': 'icon/32.png',
  '48': 'icon/48.png',
  '96': 'icon/96.png',
  '128': 'icon/128.png',
};

const HIGHLIGHT_ICON: Record<string, string> = {
  '16': 'icon/highlight-16.png',
  '32': 'icon/highlight-32.png',
  '48': 'icon/highlight-48.png',
  '96': 'icon/highlight-96.png',
  '128': 'icon/highlight-128.png',
};

let snapshot: Snapshot | null = null;
let syncLoop: Promise<InjectionStatus> | null = null;
let syncPending = false;
let lastStatus: InjectionStatus = {
  syncedAt: 0,
  appliedRuleCount: 0,
  activeRuleCount: 0,
  enabledRuleCount: 0,
  error: null,
  warning: null,
  masterEnabled: true,
  configured: false,
};

function getActionApi(): ActionApi | null {
  const candidate = browser as unknown as {
    action?: ActionApi;
    browserAction?: ActionApi;
  };
  return candidate.action ?? candidate.browserAction ?? null;
}

async function runSyncOnce(): Promise<void> {
  try {
    const { settings, rules } = await readAppState();
    snapshot = { settings, rules };

    const activeRuleCount = countActiveRules(rules, settings);
    const enabledRuleCount = rules.filter((rule) => rule.enabled).length;
    const built = buildDynamicRules(rules, settings);

    try {
      await replaceDynamicRules(built.rules);
      lastStatus = {
        syncedAt: Date.now(),
        appliedRuleCount: built.appliedRuleCount,
        activeRuleCount,
        enabledRuleCount,
        error: null,
        warning:
          built.skipped.length > 0
            ? `有 ${built.skipped.length} 条规则未生效：${built.skipped.slice(0, 3).join('；')}`
            : null,
        masterEnabled: settings.masterEnabled,
        configured: isConfigured(settings),
      };
    } catch (cause) {
      lastStatus = {
        ...lastStatus,
        syncedAt: Date.now(),
        activeRuleCount,
        enabledRuleCount,
        error: `写入注入规则失败：${describeError(cause)}`,
        masterEnabled: settings.masterEnabled,
        configured: isConfigured(settings),
      };
    }
  } catch (cause) {
    lastStatus = {
      ...lastStatus,
      syncedAt: Date.now(),
      error: `读取配置失败：${describeError(cause)}`,
    };
  }
}

/**
 * 串行同步；同步过程中又有新变更时，会在本轮结束后再跑一轮，
 * 避免快速切换 MR 时最后一次写入被丢掉。
 */
function syncAll(): Promise<InjectionStatus> {
  syncPending = true;
  if (!syncLoop) {
    syncLoop = (async (): Promise<InjectionStatus> => {
      do {
        syncPending = false;
        await runSyncOnce();
      } while (syncPending);

      // 先释放锁，后续变更可以立即开启新一轮同步
      syncLoop = null;
      await refreshBadge();
      return lastStatus;
    })();
  }
  return syncLoop;
}

async function getStatus(): Promise<InjectionStatus> {
  if (syncLoop) return syncLoop;
  if (!snapshot) return syncAll();
  return lastStatus;
}

async function refreshBadge(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (tab?.id !== undefined) {
      await updateBadgeForTab(tab.id, tab.url);
    }
  } catch {
    // 某些窗口（如 devtools）没有可访问的 tab，忽略即可
  }
}

async function updateBadgeForTab(tabId: number, url: string | undefined): Promise<void> {
  const action = getActionApi();
  if (!action) return;

  const host = getHostname(url);
  if (!host) {
    await setInactiveIcon(action, tabId);
    return;
  }

  // Service worker 被回收后 snapshot 会丢失；先同步一次再更新图标
  if (!snapshot) await syncAll();

  const settings = snapshot?.settings;
  if (!snapshot || !settings) {
    await setInactiveIcon(action, tabId);
    return;
  }

  // 域名匹配到规则就点亮图标圆点，不受总开关和单条规则启停影响
  const matching = snapshot.rules.filter((rule) =>
    hostMatchesDomain(host, rule.domain),
  );

  if (matching.length === 0) {
    await setInactiveIcon(action, tabId);
    return;
  }

  const active = matching.filter((rule) => isRuleActive(rule, settings));
  await action.setBadgeText({ tabId, text: '' });
  await action.setIcon({ tabId, path: HIGHLIGHT_ICON });

  await action.setTitle({
    tabId,
    title:
      active.length > 0
        ? 'MR Header Injector · 当前页面已命中规则'
        : `MR Header Injector · 当前页面命中 ${matching.length} 条规则，打开扩展或悬停页面右上角圆点选择 MR`,
  });
}

async function setInactiveIcon(action: ActionApi, tabId: number): Promise<void> {
  await action.setBadgeText({ tabId, text: '' });
  await action.setIcon({ tabId, path: DEFAULT_ICON });
  await action.setTitle({ tabId, title: 'MR Header Injector' });
}

async function refreshRuleMr(
  ruleId: string,
): Promise<{ ok: true; fetchedAt: number; count: number }> {
  const { settings, rules } = await readAppState();
  const rule = rules.find((item) => item.id === ruleId);
  if (!rule) throw new Error('规则不存在或已被删除');
  if (!isConfigured(settings)) throw new Error('请先在扩展设置中配置 GitLab');
  const loaded = await fetchAndCacheMrList(settings, rule);
  return { ok: true, fetchedAt: loaded.fetchedAt, count: loaded.result.items.length };
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    void syncAll();
    if (details.reason === 'install') {
      void Promise.resolve(browser.runtime.openOptionsPage()).catch(() => undefined);
    }
  });

  browser.runtime.onStartup.addListener(() => {
    void syncAll();
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (SETTINGS_KEY in changes || RULES_KEY in changes) {
      void syncAll();
    }
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = (message as { type?: unknown } | undefined)?.type;
    if (type === 'mrh:get-status') {
      getStatus()
        .then(sendResponse)
        .catch((cause) => {
          sendResponse({
            ...lastStatus,
            error: describeError(cause),
          } satisfies InjectionStatus);
        });
      return true;
    }
    if (type === 'mrh:sync') {
      syncAll()
        .then(sendResponse)
        .catch((cause) => {
          sendResponse({
            ...lastStatus,
            error: describeError(cause),
          } satisfies InjectionStatus);
        });
      return true;
    }
    if (type === 'mrh:refresh-rule-mr') {
      const ruleId = (message as { ruleId?: unknown }).ruleId;
      if (typeof ruleId !== 'string') {
        sendResponse({ error: '缺少规则 ID' });
        return true;
      }
      refreshRuleMr(ruleId)
        .then(sendResponse)
        .catch((cause) => sendResponse({ error: describeError(cause) }));
      return true;
    }
    if (type === 'mrh:open-options') {
      Promise.resolve(browser.runtime.openOptionsPage())
        .then(() => sendResponse({ ok: true }))
        .catch((cause) => sendResponse({ error: describeError(cause) }));
      return true;
    }
    return undefined;
  });

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void browser.tabs
      .get(tabId)
      .then((tab) => updateBadgeForTab(tabId, tab.url))
      .catch(() => undefined);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      void updateBadgeForTab(tabId, tab.url);
    }
  });

  void syncAll();
});
