import { browser } from 'wxt/browser';
import type { Browser } from 'wxt/browser';
import type { DnrRule } from './rules';

export async function getDynamicRules(): Promise<DnrRule[]> {
  return browser.declarativeNetRequest.getDynamicRules();
}

/**
 * 用新规则整体替换动态规则。updateDynamicRules 是原子操作：
 * 只要其中一条规则不合法，这次更新就不会生效，旧规则会保留。
 */
export async function replaceDynamicRules(nextRules: DnrRule[]): Promise<void> {
  const existing = await getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);
  if (removeRuleIds.length === 0 && nextRules.length === 0) return;

  const update: Browser.declarativeNetRequest.UpdateRuleOptions = {
    removeRuleIds,
  };
  if (nextRules.length > 0) update.addRules = nextRules;

  await browser.declarativeNetRequest.updateDynamicRules(update);
}

export async function clearDynamicRules(): Promise<void> {
  const existing = await getDynamicRules();
  if (existing.length === 0) return;
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
  });
}
