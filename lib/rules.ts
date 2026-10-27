import type { Browser } from 'wxt/browser';
import {
  normalizeProjectPath,
  validateExtraQuery,
  validateProjectPath,
} from './gitlab';
import { parseRedirectTarget, validateRegexPattern } from './pattern';
import {
  isMrState,
  type AppSettings,
  type InjectionRule,
  type MrState,
  type RuleMode,
} from './types';

export type DnrRule = Browser.declarativeNetRequest.Rule;

/** 显式列出所有资源类型，避免 DNR 默认排除 main_frame。 */
const DNR_RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'csp_report',
  'media',
  'websocket',
  'other',
] as const;

export interface RuleDraft {
  mode: RuleMode;
  pattern: string;
  redirectTarget: string;
  headerName: string;
  projectPath: string;
  mrState: MrState;
  perPage: number;
  extraQuery: string;
  enabled: boolean;
}

export type RuleDraftErrors = Partial<Record<keyof RuleDraft | 'form', string>>;

export interface ValidatedRuleDraft extends RuleDraft {
  pattern: string;
  redirectTarget: string;
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
  if (!settings.masterEnabled || !rule.enabled) return false;

  if (rule.mode === 'redirect') {
    return !validateRegexPattern(rule.pattern) && parseRedirectTarget(rule.redirectTarget).ok;
  }

  return (
    isConfigured(settings) &&
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
    mode: 'header',
    pattern: '',
    redirectTarget: '',
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
  const mode: RuleMode = draft.mode === 'redirect' ? 'redirect' : 'header';
  const pattern = draft.pattern.trim();
  const patternError = validateRegexPattern(pattern);
  if (patternError) errors.pattern = patternError;

  const duplicatePattern = pattern
    ? existingRules.some(
        (rule) =>
          rule.id !== editingId &&
          rule.mode === mode &&
          rule.pattern.trim().toLowerCase() === pattern.toLowerCase(),
      )
    : false;
  if (duplicatePattern) errors.pattern = '这个正则已经有同模式规则了，请直接编辑那条规则';

  let headerName = draft.headerName.trim() || 'X-MR-ID';
  let projectPath = normalizeProjectPath(draft.projectPath);
  let redirectTarget = '';

  if (mode === 'header') {
    if (!headerName) {
      errors.headerName = '请输入请求头名称';
    } else if (!HEADER_NAME_RE.test(headerName) || headerName.length > 100) {
      errors.headerName = '请求头名称不合法';
    } else if (FORBIDDEN_HEADERS.has(headerName.toLowerCase())) {
      errors.headerName = '浏览器不允许修改这个请求头';
    }

    const projectError = validateProjectPath(projectPath);
    if (projectError) errors.projectPath = projectError;

    const perPage = Number(draft.perPage);
    if (!Number.isFinite(perPage) || perPage < 1 || perPage > 100) {
      errors.perPage = '每页数量需在 1 - 100 之间';
    }

    const extraError = validateExtraQuery(draft.extraQuery);
    if (extraError) errors.extraQuery = extraError;

    if (!isMrState(draft.mrState)) errors.mrState = '请选择 MR 状态';
  } else {
    const target = parseRedirectTarget(draft.redirectTarget);
    if (!target.ok) {
      errors.redirectTarget = target.error;
    } else {
      redirectTarget = target.target.display;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors, normalized: null };
  }

  const perPage = Number(draft.perPage);
  return {
    errors,
    normalized: {
      mode,
      pattern,
      redirectTarget,
      headerName,
      projectPath,
      mrState: isMrState(draft.mrState) ? draft.mrState : 'opened',
      perPage: Number.isFinite(perPage)
        ? Math.min(100, Math.max(1, Math.round(perPage)))
        : 100,
      extraQuery: draft.extraQuery.trim().replace(/^\?/, ''),
      enabled: draft.enabled,
    },
  };
}

export interface BuiltDnrRules {
  rules: DnrRule[];
  /** 因数据不合法被跳过的规则说明。 */
  skipped: string[];
  /** 成功生成 DNR 规则的应用规则数量。 */
  appliedRuleCount: number;
}

export function buildDynamicRules(
  rules: InjectionRule[],
  settings: AppSettings,
): BuiltDnrRules {
  if (!settings.masterEnabled) {
    return { rules: [], skipped: [], appliedRuleCount: 0 };
  }

  const result: DnrRule[] = [];
  const skipped: string[] = [];
  const usedIds = new Set<number>();
  let appliedRuleCount = 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const pattern = rule.pattern.trim();
    const patternError = validateRegexPattern(pattern);
    if (patternError) {
      skipped.push(`「${pattern || rule.headerName || '未命名规则'}」${patternError}`);
      continue;
    }

    if (rule.mode === 'redirect') {
      const targetResult = parseRedirectTarget(rule.redirectTarget);
      if (!targetResult.ok) {
        skipped.push(`「${pattern}」${targetResult.error}`);
        continue;
      }
      const target = targetResult.target;
      result.push({
        id: nextDnrId(`${rule.id}:redirect`, usedIds),
        priority: 200 + Math.min(1000, pattern.length),
        action: {
          type: 'redirect',
          redirect: {
            transform: {
              host: target.host,
              ...(target.scheme ? { scheme: target.scheme } : {}),
              ...(target.port !== undefined ? { port: target.port } : {}),
              ...(target.path ? { path: target.path } : {}),
            },
          },
        },
        condition: {
          regexFilter: pattern,
          isUrlFilterCaseSensitive: false,
          resourceTypes: [...DNR_RESOURCE_TYPES],
        },
      });
      appliedRuleCount += 1;
      continue;
    }

    if (!isConfigured(settings)) continue;

    const mr = rule.selectedMr;
    if (!mr || mr.iid <= 0 || mr.projectPath !== rule.projectPath) continue;

    const headerName = rule.headerName.trim();
    if (!HEADER_NAME_RE.test(headerName) || FORBIDDEN_HEADERS.has(headerName.toLowerCase())) {
      skipped.push(`「${pattern}」请求头名称无效`);
      continue;
    }

    result.push({
      id: nextDnrId(`${rule.id}:header`, usedIds),
      priority: 100 + Math.min(100, pattern.length),
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          {
            header: headerName,
            operation: 'set',
            value: String(mr.iid),
          },
        ],
      },
      condition: {
        regexFilter: pattern,
        isUrlFilterCaseSensitive: false,
        resourceTypes: [...DNR_RESOURCE_TYPES],
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
