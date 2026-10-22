/** 支持拉取的 MR 状态，all 表示不传 state。 */
export type MrState = 'opened' | 'merged' | 'closed' | 'all';

export const MR_STATE_OPTIONS: ReadonlyArray<{ value: MrState; label: string }> = [
  { value: 'opened', label: 'Open（默认）' },
  { value: 'merged', label: 'Merged' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: '全部状态' },
];

export const MR_STATE_LABELS: Record<MrState, string> = {
  opened: 'Open',
  merged: 'Merged',
  closed: 'Closed',
  all: '全部',
};

export function isMrState(value: unknown): value is MrState {
  return value === 'opened' || value === 'merged' || value === 'closed' || value === 'all';
}

/** 用户选中的 MR，字段冗余保存，列表刷新后仍可展示。 */
export interface SelectedMr {
  iid: number;
  title: string;
  state: string;
  webUrl: string;
  sourceBranch?: string;
  targetBranch?: string;
  authorName?: string;
  /** 记录选择时所属的仓库，仓库改动后自动失效。 */
  projectPath: string;
  selectedAt: number;
}

export interface InjectionRule {
  id: string;
  /** 归一化后的页面域名，不带通配符，例如 aaa.com。DNR 会同时匹配其子域。 */
  domain: string;
  /** 注入的请求头名，默认 X-MR-ID。 */
  headerName: string;
  /** GitLab 仓库路径（group/project）或数字 project id。 */
  projectPath: string;
  /** MR 查询状态，默认 opened。 */
  mrState: MrState;
  /** 单次拉取数量，GitLab 上限 100。 */
  perPage: number;
  /** 额外 query string，例如 labels=bug&author_username=me。 */
  extraQuery: string;
  enabled: boolean;
  selectedMr: SelectedMr | null;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  gitlabBaseUrl: string;
  token: string;
  masterEnabled: boolean;
  /** 是否在页面右上角注入悬浮入口。 */
  pageOverlayEnabled: boolean;
}

export interface StoredAppState {
  settings: AppSettings;
  rules: InjectionRule[];
}

export interface MrOption {
  iid: number;
  title: string;
  state: string;
  draft: boolean;
  webUrl: string;
  sourceBranch: string;
  targetBranch: string;
  authorName: string;
  updatedAt: string;
}

export interface MrListResult {
  items: MrOption[];
  hasMore: boolean;
  total: number | null;
}

/** MR 概要信息。 */
export interface MrInfo {
  iid: number;
  title: string;
  state: string;
  webUrl?: string;
  sourceBranch?: string;
  targetBranch?: string;
  authorName?: string;
}

/** 按规则持久化的 MR 列表缓存，popup 命中时直接使用。 */
export interface MrCacheEntry {
  ruleId: string;
  /** 仓库 / 状态 / 分页 / 额外查询参数发生变化时，旧缓存自动失效。 */
  queryKey: string;
  fetchedAt: number;
  result: MrListResult;
}

export type MrCacheMap = Record<string, MrCacheEntry>;

export interface GitLabIdentity {
  id: number;
  username: string;
  name: string;
  webUrl: string;
}

/** 后台同步 DNR 后的状态，供 popup/options 展示。 */
export interface InjectionStatus {
  syncedAt: number;
  /** 实际生效的应用规则数量（每条会写入「页面来源 + 文档导航」两条 DNR 规则）。 */
  appliedRuleCount: number;
  /** 按当前配置本应生效的规则数量。 */
  activeRuleCount: number;
  enabledRuleCount: number;
  error: string | null;
  warning: string | null;
  masterEnabled: boolean;
  configured: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  gitlabBaseUrl: '',
  token: '',
  masterEnabled: true,
  pageOverlayEnabled: true,
};
