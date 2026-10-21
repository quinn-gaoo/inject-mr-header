import type { Browser } from 'wxt/browser';
import { parseDomainInput } from './domain';
import {
  normalizeProjectPath,
  validateExtraQuery,
  validateProjectPath,
} from './gitlab';
import {
  isMrState,
  type AppSettings,
  type InjectionRule,
  type MrState,
} from './types';

export type DnrRule = Browser.declarativeNetRequest.Rule;

export interface RuleDraft {
  domain: string;
  headerName: string;
  projectPath: string;
  mrState: MrState;
  perPage: number;
  extraQuery: string;
  enabled: boolean;
}

export type RuleDraftErrors = Partial<Record<keyof RuleDraft | 'form', string>>;

export interface ValidatedRuleDraft extends RuleDraft {
  domain: string;
  projectPath: string;
}

const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const FORBIDDEN_HEADERS = new Set([
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'upgrade',
  'keep-alive',
  'proxy-authorization',
  'te',
  'trailer',
]);

export function isConfigured(settings: AppSettings): boolean {
  return Boolean(settings.gitlabBaseUrl.trim() && settings.token.trim());
}

export function isRuleActive(rule: InjectionRule, settings: AppSettings): boolean {
  return (
    settings.masterEnabled &&
    isConfigured(settings) &&
    rule.enabled &&
    rule.selectedMr !== null &&
    rule.selectedMr.iid > 0 &&
    rule.selectedMr.projectPath === rule.projectPath
  );
}

export function countActiveRules(rules: InjectionRule[], settings: AppSettings): number {
  return rules.filter((rule) => isRuleActive(rule, settings)).length;
}

export function createEmptyDraft(headerName = 'X-MR-ID'): RuleDraft {
  return {
    domain: '',
    headerName,
    projectPath: '',
    mrState: 'opened',
    perPage: 100,
    extraQuery: '',
    enabled: true,
  };
}

export function validateRuleDraft(
  draft: RuleDraft,
  existingRules: InjectionRule[],
  editingId?: string,
): { errors: RuleDraftErrors; normalized: ValidatedRuleDraft | null } {
  const errors: RuleDraftErrors = {};

  const domainResult = parseDomainInput(draft.domain);
  if (!domainResult.ok) {
    errors.domain = domainResult.error;
  } else {
    const duplicate = existingRules.some(
      (rule) => rule.id !== editingId && rule.domain.toLowerCase() === domainResult.domain,
    );
    if (duplicate) errors.domain = '这个域名已经有规则了，请直接编辑那条规则';
  }

  const headerName = draft.headerName.trim();
  if (!headerName) {
    errors.headerName = '请输入请求头名称';
  } else if (!HEADER_NAME_RE.test(headerName) || headerName.length > 100) {
    errors.headerName = '请求头名称不合法';
  } else if (FORBIDDEN_HEADERS.has(headerName.toLowerCase())) {
    errors.headerName = '浏览器不允许修改这个请求头';
  }

  const projectPath = normalizeProjectPath(draft.projectPath);
  const projectError = validateProjectPath(projectPath);
  if (projectError) errors.projectPath = projectError;

  const perPage = Number(draft.perPage);
  if (!Number.isFinite(perPage) || perPage < 1 || perPage > 100) {
    errors.perPage = '每页数量需在 1 - 100 之间';
  }

  const extraError = validateExtraQuery(draft.extraQuery);
  if (extraError) errors.extraQuery = extraError;

  if (!isMrState(draft.mrState)) errors.mrState = '请选择 MR 状态';

  if (Object.keys(errors).length > 0 || !domainResult.ok) {
    return { errors, normalized: null };
  }

  return {
    errors,
    normalized: {
      domain: domainResult.domain,
      headerName,
      projectPath,
      mrState: draft.mrState,
      perPage: Math.min(100, Math.max(1, Math.round(perPage))),
      extraQuery: draft.extraQuery.trim().replace(/^\?/, ''),
      enabled: draft.enabled,
    },
  };
}

export interface BuiltDnrRules {
  rules: DnrRule[];
  /** 因数据不合法被跳过的规则说明。 */
  skipped: string[];
  /** 成功生成注入规则的应用规则数量（一条应用规则会生成来源 + 文档两条 DNR 规则）。 */
  appliedRuleCount: number;
}

export function buildDynamicRules(
  rules: InjectionRule[],
  settings: AppSettings,
): BuiltDnrRules {
  if (!settings.masterEnabled || !isConfigured(settings)) {
    return { rules: [], skipped: [], appliedRuleCount: 0 };
  }

  const result: DnrRule[] = [];
  const skipped: string[] = [];
  const usedIds = new Set<number>();
  let appliedRuleCount = 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const mr = rule.selectedMr;
    if (!mr || mr.iid <= 0 || mr.projectPath !== rule.projectPath) continue;

    const domainResult = parseDomainInput(rule.domain);
    if (!domainResult.ok) {
      skipped.push(`「${rule.domain || '未命名规则'}」域名无效`);
      continue;
    }

    const headerName = rule.headerName.trim();
    if (!HEADER_NAME_RE.test(headerName) || FORBIDDEN_HEADERS.has(headerName.toLowerCase())) {
      skipped.push(`「${domainResult.domain}」请求头名称无效`);
      continue;
    }

    const domain = domainResult.domain;
    const priority = Math.min(100_000, 100 + domain.split('.').length * 100 + domain.length);
    const action: DnrRule['action'] = {
      type: 'modifyHeaders',
      requestHeaders: [
        {
          header: headerName,
          operation: 'set',
          value: String(mr.iid),
        },
      ],
    };

    // 1) 页面在规则域名下时，页面发起的请求（含跨域接口）都注入
    result.push({
      id: nextDnrId(`${rule.id}:initiator`, usedIds),
      priority,
      action,
      condition: {
        initiatorDomains: [domain],
      },
    });

    // 2) 地址栏/顶层导航的 HTML 文档请求本身没有 initiator，单独按目标域名匹配
    result.push({
      id: nextDnrId(`${rule.id}:document`, usedIds),
      priority: Math.min(100_000, priority + 1),
      action,
      condition: {
        requestDomains: [domain],
        resourceTypes: ['main_frame'],
      },
    });

    appliedRuleCount += 1;
  }

  return { rules: result, skipped, appliedRuleCount };
}

function nextDnrId(key: string, used: Set<number>): number {
  let id = hashRuleId(key);
  while (used.has(id)) {
    id = id >= 0x7ffffffe ? 1 : id + 1;
  }
  used.add(id);
  return id;
}

function hashRuleId(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % 0x7ffffffe) + 1;
}
